/**
 * Pruebas de las reglas de Firestore (fase 13, etapa 2; pruebas 8–14 de la propuesta).
 *
 * Ejecutar (necesita JDK 21+ para el emulador):
 *   npm run test:reglas
 */
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const entorno = await initializeTestEnvironment({
  projectId: "demo-acia",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
});

let pasadas = 0;
async function prueba(nombre, fn) {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (c) => {
    const bd = c.firestore();
    await setDoc(doc(bd, "usuarios/A/ranuras/activo1"), { estado: "activo" });
    await setDoc(doc(bd, "usuarios/A/ranuras/archivado1"), { estado: "archivado" });
    await setDoc(doc(bd, "usuarios/A/lotes/l1"), { restante: 20 });
    await setDoc(doc(bd, "usuarios/B/lotes/l1"), { restante: 99 });
  });
  try {
    await fn();
    pasadas++;
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    console.error(`  FALLA ${nombre}\n        ${e.message}`);
    process.exitCode = 1;
  }
}

const verificado = { email_verified: true };
const a = () => entorno.authenticatedContext("A", verificado).firestore();
const aSinVerificar = () =>
  entorno.authenticatedContext("A", { email_verified: false }).firestore();
const b = () => entorno.authenticatedContext("B", verificado).firestore();
const anonimo = () => entorno.unauthenticatedContext().firestore();

const sobre = () => ({ v: 2, kid: 1, iv: "AAAAAAAAAAAAAAAA", ct: "Y2lmcmFkbw==" });
const hash = "a".repeat(64);
const parte = (o = {}) => ({
  sobre: sobre(),
  rev: 1,
  tipo: "sesion",
  actualizado_en: serverTimestamp(),
  dispositivo_id: "d1",
  hash_ct: hash,
  ...o,
});
const cabecera = (caso, o = {}) => ({
  cc_envuelta: { caso_uid: caso, kid: 1, iv: "AAAAAAAAAAAAAAAA", cc: "Y2M=" },
  rev: 1,
  actualizado_en: serverTimestamp(),
  dispositivo_id: "d1",
  ...o,
});
const rutaParte = "usuarios/A/casos/activo1/partes/p1";

console.log("\nReglas de Firestore\n");

// 8. Aislamiento entre usuarios
await prueba("A no lee ni escribe nada de B", async () => {
  await assertFails(getDoc(doc(a(), "usuarios/B/lotes/l1")));
  await assertFails(setDoc(doc(a(), "usuarios/B/casos/x/partes/p1"), parte()));
  await assertFails(getDoc(doc(b(), "usuarios/A/lotes/l1")));
});
await prueba("sin sesión no se lee nada", async () => {
  await assertFails(getDoc(doc(anonimo(), "usuarios/A/lotes/l1")));
});
await prueba("el dueño lee su saldo (lotes) y los planes son públicos", async () => {
  await assertSucceeds(getDoc(doc(a(), "usuarios/A/lotes/l1")));
  await assertSucceeds(getDoc(doc(anonimo(), "planes/gratuito")));
});

// 9. Correo verificado
await prueba("sin correo verificado: ni lee ni escribe", async () => {
  await assertFails(getDoc(doc(aSinVerificar(), "usuarios/A/lotes/l1")));
  await assertFails(setDoc(doc(aSinVerificar(), rutaParte), parte()));
});

// 10. El cliente no escribe lo administrativo
await prueba("el cliente no escribe lo administrativo", async () => {
  for (const ruta of [
    "usuarios/A",
    "usuarios/A/ranuras/nuevo",
    "usuarios/A/ranuras/activo1",
    "usuarios/A/lotes/l1",
    "usuarios/A/operaciones/o1",
    "usuarios/A/movimientos/m1",
    "usuarios/A/pagos/p1",
    "usuarios/A/consentimientos/c1",
    "planes/gratuito",
    "eventos_proveedor/e1",
  ]) {
    await assertFails(setDoc(doc(a(), ruta), { restante: 1000, estado: "activo" }));
  }
});

// 11. Forma, tamaño y revisión
await prueba("crear una parte válida con ranura activa funciona", async () => {
  await assertSucceeds(setDoc(doc(a(), rutaParte), parte()));
});
await prueba("parte con campos extra, tipo desconocido o sobre alterado: rechazada", async () => {
  await assertFails(setDoc(doc(a(), rutaParte), parte({ alias: "María" })));
  await assertFails(setDoc(doc(a(), rutaParte), parte({ tipo: "texto_libre" })));
  await assertFails(setDoc(doc(a(), rutaParte), parte({ sobre: { ...sobre(), nota: "hola" } })));
  await assertFails(setDoc(doc(a(), rutaParte), parte({ sobre: { ...sobre(), v: 1 } })));
});
await prueba("parte demasiado grande: rechazada", async () => {
  await assertFails(
    setDoc(doc(a(), rutaParte), parte({ sobre: { ...sobre(), ct: "A".repeat(800001) } }))
  );
});
await prueba("actualizar exige rev + 1 y no cambiar el tipo", async () => {
  await assertSucceeds(setDoc(doc(a(), rutaParte), parte()));
  await assertFails(setDoc(doc(a(), rutaParte), parte({ rev: 1 })));
  await assertFails(setDoc(doc(a(), rutaParte), parte({ rev: 3 })));
  await assertFails(setDoc(doc(a(), rutaParte), parte({ rev: 2, tipo: "nota" })));
  await assertSucceeds(setDoc(doc(a(), rutaParte), parte({ rev: 2 })));
});
await prueba("la fecha de sincronización no se puede falsear", async () => {
  await assertFails(
    setDoc(
      doc(a(), rutaParte),
      parte({ actualizado_en: Timestamp.fromDate(new Date("2020-01-01")) })
    )
  );
});
await prueba("cabecera de caso: solo con su propio caso_uid", async () => {
  await assertSucceeds(setDoc(doc(a(), "usuarios/A/casos/activo1"), cabecera("activo1")));
  await assertFails(setDoc(doc(a(), "usuarios/A/casos/activo1"), cabecera("otro")));
});

// 12. Ranura archivada o inexistente
await prueba("ranura archivada: se puede leer, no escribir", async () => {
  await entorno.withSecurityRulesDisabled((c) =>
    setDoc(
      doc(c.firestore(), "usuarios/A/casos/archivado1/partes/p1"),
      parte({ actualizado_en: Timestamp.now() })
    )
  );
  await assertSucceeds(getDoc(doc(a(), "usuarios/A/casos/archivado1/partes/p1")));
  await assertFails(
    setDoc(doc(a(), "usuarios/A/casos/archivado1/partes/p1"), parte({ rev: 2 }))
  );
  await assertFails(setDoc(doc(a(), "usuarios/A/casos/archivado1/partes/p2"), parte()));
});
await prueba("sin ranura no hay escritura clínica", async () => {
  await assertFails(setDoc(doc(a(), "usuarios/A/casos/sinranura/partes/p1"), parte()));
  await assertFails(setDoc(doc(a(), "usuarios/A/casos/sinranura"), cabecera("sinranura")));
});

// 13. App Check se exige en la consola de Firebase, no en las reglas (propuesta §5).

// 14. Sin borrado desde el cliente
await prueba("el cliente no borra partes, cabeceras ni la bóveda", async () => {
  await assertSucceeds(setDoc(doc(a(), rutaParte), parte()));
  await assertFails(deleteDoc(doc(a(), rutaParte)));
  await assertSucceeds(setDoc(doc(a(), "usuarios/A/casos/activo1"), cabecera("activo1")));
  await assertFails(deleteDoc(doc(a(), "usuarios/A/casos/activo1")));
  await assertFails(deleteDoc(doc(a(), "usuarios/A/boveda/principal")));
});

// Bóveda e índice
const boveda = (o = {}) => ({
  formato: 1,
  version_clave: 1,
  creado_en: "2026-10-18T00:00:00Z",
  ranuras: [{ id: "r1", tipo: "frase", iv: "x", cmd: "y" }],
  ...o,
});
await prueba("bóveda: una sola, formato válido, la versión de clave no baja", async () => {
  await assertSucceeds(setDoc(doc(a(), "usuarios/A/boveda/principal"), boveda()));
  await assertFails(setDoc(doc(a(), "usuarios/A/boveda/otra"), boveda()));
  await assertFails(setDoc(doc(a(), "usuarios/A/boveda/principal"), boveda({ version_clave: 0 })));
  await assertSucceeds(updateDoc(doc(a(), "usuarios/A/boveda/principal"), { version_clave: 2 }));
  await assertFails(setDoc(doc(a(), "usuarios/A/boveda/principal"), boveda({ frase: "en claro" })));
  await assertFails(getDoc(doc(b(), "usuarios/A/boveda/principal")));
});
await prueba("índice: con ranura existente (activa o archivada) y rev + 1", async () => {
  const ind = (o = {}) => ({
    sobre: sobre(),
    rev: 1,
    actualizado_en: serverTimestamp(),
    dispositivo_id: "d1",
    ...o,
  });
  await assertSucceeds(setDoc(doc(a(), "usuarios/A/indice/archivado1"), ind()));
  await assertSucceeds(setDoc(doc(a(), "usuarios/A/indice/archivado1"), ind({ rev: 2 })));
  await assertFails(setDoc(doc(a(), "usuarios/A/indice/inexistente"), ind()));
});

// Historial de partes (etapa 5)
const rutaHist = (id) => `usuarios/A/casos/activo1/partes_historial/${id}`;
const historial = (o = {}) => ({
  parte_id: "p1",
  sobre: sobre(),
  rev: 1,
  tipo: "sesion",
  hash_ct: hash,
  dispositivo_id: "d1",
  archivado_en: serverTimestamp(),
  expira_en: Timestamp.fromMillis(Date.now() + 30 * 86_400_000),
  ...o,
});
const conParteVigente = (rev = 1) =>
  entorno.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), rutaParte), parte({ rev, actualizado_en: Timestamp.now() }))
  );

await prueba("historial: se archiva solo la versión vigente, con su id y caducidad", async () => {
  await conParteVigente(1);
  await assertSucceeds(setDoc(doc(a(), rutaHist("p1__1")), historial()));
  await assertFails(setDoc(doc(a(), rutaHist("p1__2")), historial()), "id que no corresponde a la revisión");
  await assertFails(setDoc(doc(a(), rutaHist("p1__9")), historial({ rev: 9 })), "no es la vigente");
  await assertFails(setDoc(doc(a(), rutaHist("x__1")), historial({ parte_id: "inexistente" })));
});
await prueba("historial: no se falsea la caducidad ni se añaden campos", async () => {
  await conParteVigente(1);
  await assertFails(setDoc(doc(a(), rutaHist("p1__1")), historial({ expira_en: Timestamp.fromMillis(Date.now() + 400 * 86_400_000) })));
  await assertFails(setDoc(doc(a(), rutaHist("p1__1")), historial({ expira_en: Timestamp.fromMillis(Date.now() - 1000) })));
  await assertFails(setDoc(doc(a(), rutaHist("p1__1")), historial({ texto: "en claro" })));
});
await prueba("historial: ni editar ni borrar; solo lo lee su dueño; sin ranura activa no se crea", async () => {
  await conParteVigente(1);
  await assertSucceeds(setDoc(doc(a(), rutaHist("p1__1")), historial()));
  await assertFails(updateDoc(doc(a(), rutaHist("p1__1")), { rev: 5 }));
  await assertFails(deleteDoc(doc(a(), rutaHist("p1__1"))));
  await assertSucceeds(getDoc(doc(a(), rutaHist("p1__1"))));
  await assertFails(getDoc(doc(b(), rutaHist("p1__1"))));
  await entorno.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), "usuarios/A/casos/archivado1/partes/p1"), parte({ actualizado_en: Timestamp.now() }))
  );
  await assertFails(setDoc(doc(a(), "usuarios/A/casos/archivado1/partes_historial/p1__1"), historial()));
});

await entorno.cleanup();
console.log(`\n${pasadas} pruebas pasadas\n`);
