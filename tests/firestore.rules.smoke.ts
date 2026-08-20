import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'chekify-rules-test';
let testEnv: RulesTestEnvironment;

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const users = [
      ['admin', 'Administrador', 'plant-a'],
      ['supervisorA', 'Supervisor', 'plant-a'],
      ['supervisorB', 'Supervisor', 'plant-b'],
      ['operatorA', 'Operador', 'plant-a'],
    ] as const;

    for (const [uid, role, plantId] of users) {
      await setDoc(doc(db, `users/${uid}`), {
        uid,
        role,
        plantId,
        email: `${uid}@test.local`,
      });
    }

    await setDoc(doc(db, 'equipment/equipmentA'), {
      id: 'equipmentA', plantId: 'plant-a', areaId: 'area-a', name: 'Equipo A',
    });
    await setDoc(doc(db, 'equipment/equipmentB'), {
      id: 'equipmentB', plantId: 'plant-b', areaId: 'area-b', name: 'Equipo B',
    });
  });
}

async function run() {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    await seed();

    const supervisor = testEnv.authenticatedContext('supervisorA').firestore();
    const operator = testEnv.authenticatedContext('operatorA').firestore();
    const admin = testEnv.authenticatedContext('admin', {
      email: 'maisserk@gmail.com',
    }).firestore();

    await assertSucceeds(getDoc(doc(supervisor, 'equipment/equipmentA')));
    await assertFails(getDoc(doc(supervisor, 'equipment/equipmentB')));

    await assertSucceeds(setDoc(doc(supervisor, 'equipment/equipmentA2'), {
      id: 'equipmentA2', plantId: 'plant-a', areaId: 'area-a', name: 'Equipo A2',
    }));

    await assertFails(setDoc(doc(supervisor, 'equipment/equipmentB2'), {
      id: 'equipmentB2', plantId: 'plant-b', areaId: 'area-b', name: 'Equipo B2',
    }));

    await assertFails(updateDoc(doc(supervisor, 'equipment/equipmentA'), {
      plantId: 'plant-b',
    }));

    await assertFails(deleteDoc(doc(supervisor, 'equipment/equipmentB')));
    await assertFails(updateDoc(doc(operator, 'equipment/equipmentA'), {
      name: 'Cambio no autorizado',
    }));

    await assertSucceeds(getDoc(doc(admin, 'equipment/equipmentA')));
    await assertSucceeds(getDoc(doc(admin, 'equipment/equipmentB')));

    console.log('Firestore equipment Rules smoke test: PASS');
  } finally {
    await testEnv.cleanup();
  }
}

run().catch((error) => {
  console.error('Firestore Rules smoke test: FAIL');
  console.error(error);
  process.exitCode = 1;
});
