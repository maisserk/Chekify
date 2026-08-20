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

    await setDoc(doc(db, 'findings/findingA'), {
      id: 'findingA', plantId: 'plant-a', areaId: 'area-a', equipmentId: 'equipmentA',
      inspectionId: 'inspectionA', operatorId: 'operatorA', description: 'Hallazgo A', status: 'Open',
    });
    await setDoc(doc(db, 'findings/findingB'), {
      id: 'findingB', plantId: 'plant-b', areaId: 'area-b', equipmentId: 'equipmentB',
      inspectionId: 'inspectionB', operatorId: 'supervisorB', description: 'Hallazgo B', status: 'Open',
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

    // Equipment tenant isolation.
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

    // Findings tenant isolation. Keep same-plant write semantics unchanged for now;
    // this phase only guarantees that a user cannot cross plant boundaries.
    await assertSucceeds(getDoc(doc(supervisor, 'findings/findingA')));
    await assertFails(getDoc(doc(supervisor, 'findings/findingB')));
    await assertSucceeds(getDoc(doc(operator, 'findings/findingA')));
    await assertFails(getDoc(doc(operator, 'findings/findingB')));

    await assertSucceeds(setDoc(doc(operator, 'findings/findingA2'), {
      id: 'findingA2', plantId: 'plant-a', areaId: 'area-a', equipmentId: 'equipmentA',
      inspectionId: 'inspectionA2', operatorId: 'operatorA', description: 'Hallazgo A2', status: 'Open',
    }));

    await assertFails(setDoc(doc(operator, 'findings/findingB2'), {
      id: 'findingB2', plantId: 'plant-b', areaId: 'area-b', equipmentId: 'equipmentB',
      inspectionId: 'inspectionB2', operatorId: 'operatorA', description: 'Hallazgo B2', status: 'Open',
    }));

    await assertFails(updateDoc(doc(operator, 'findings/findingA'), {
      plantId: 'plant-b',
    }));
    await assertFails(updateDoc(doc(operator, 'findings/findingB'), {
      description: 'Acceso cruzado',
    }));
    await assertFails(deleteDoc(doc(operator, 'findings/findingB')));

    await assertSucceeds(getDoc(doc(admin, 'findings/findingA')));
    await assertSucceeds(getDoc(doc(admin, 'findings/findingB')));

    console.log('Firestore equipment/findings Rules smoke test: PASS');
  } finally {
    await testEnv.cleanup();
  }
}

run().catch((error) => {
  console.error('Firestore Rules smoke test: FAIL');
  console.error(error);
  process.exitCode = 1;
});
