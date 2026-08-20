import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const projectId = 'chekify-rules-test';

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/admin'), {
      uid: 'admin',
      role: 'Administrador',
      plantId: 'plant-a',
      email: 'admin@test.local',
    });
    await setDoc(doc(db, 'users/supervisorA'), {
      uid: 'supervisorA',
      role: 'Supervisor',
      plantId: 'plant-a',
      email: 'supervisor-a@test.local',
    });
    await setDoc(doc(db, 'users/supervisorB'), {
      uid: 'supervisorB',
      role: 'Supervisor',
      plantId: 'plant-b',
      email: 'supervisor-b@test.local',
    });
    await setDoc(doc(db, 'users/operatorA'), {
      uid: 'operatorA',
      role: 'Operador',
      plantId: 'plant-a',
      email: 'operator-a@test.local',
    });

    await setDoc(doc(db, 'equipment/equipmentA'), {
      id: 'equipmentA',
      plantId: 'plant-a',
      areaId: 'area-a',
      name: 'Equipo A',
    });
    await setDoc(doc(db, 'equipment/equipmentB'), {
      id: 'equipmentB',
      plantId: 'plant-b',
      areaId: 'area-b',
      name: 'Equipo B',
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: require('fs').readFileSync('firestore.rules', 'utf8') },
  });
  await seed();
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe('equipment Firestore rules', () => {
  test('Supervisor can read equipment in their own plant', async () => {
    const db = testEnv.authenticatedContext('supervisorA').firestore();
    await assertSucceeds(getDoc(doc(db, 'equipment/equipmentA')));
  });

  test('Supervisor cannot read equipment from another plant', async () => {
    const db = testEnv.authenticatedContext('supervisorA').firestore();
    await assertFails(getDoc(doc(db, 'equipment/equipmentB')));
  });

  test('Supervisor can create equipment in their own plant', async () => {
    const db = testEnv.authenticatedContext('supervisorA').firestore();
    await assertSucceeds(setDoc(doc(db, 'equipment/equipmentA2'), {
      id: 'equipmentA2',
      plantId: 'plant-a',
      areaId: 'area-a',
      name: 'Equipo A2',
    }));
  });

  test('Supervisor cannot create equipment in another plant', async () => {
    const db = testEnv.authenticatedContext('supervisorA').firestore();
    await assertFails(setDoc(doc(db, 'equipment/equipmentB2'), {
      id: 'equipmentB2',
      plantId: 'plant-b',
      areaId: 'area-b',
      name: 'Equipo B2',
    }));
  });

  test('Supervisor cannot move equipment to another plant', async () => {
    const db = testEnv.authenticatedContext('supervisorA').firestore();
    await assertFails(updateDoc(doc(db, 'equipment/equipmentA'), {
      plantId: 'plant-b',
    }));
  });

  test('Supervisor cannot delete equipment from another plant', async () => {
    const db = testEnv.authenticatedContext('supervisorA').firestore();
    await assertFails(deleteDoc(doc(db, 'equipment/equipmentB')));
  });

  test('Operator cannot modify equipment', async () => {
    const db = testEnv.authenticatedContext('operatorA').firestore();
    await assertFails(updateDoc(doc(db, 'equipment/equipmentA'), {
      name: 'Cambio no autorizado',
    }));
  });

  test('Admin can read equipment from both plants', async () => {
    const db = testEnv.authenticatedContext('admin', {
      email: 'maisserk@gmail.com',
    }).firestore();
    await assertSucceeds(getDoc(doc(db, 'equipment/equipmentA')));
    await assertSucceeds(getDoc(doc(db, 'equipment/equipmentB')));
  });
});
