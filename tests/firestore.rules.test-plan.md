# Firestore Rules — equipment test plan

These cases are intended to be executed with the Firebase Emulator before merging `fix/security-hardening` into `main`.

## Preconditions

Create users with these profiles:

- `admin`: role `Administrador`, plantId `plant-a`
- `supervisorA`: role `Supervisor`, plantId `plant-a`
- `supervisorB`: role `Supervisor`, plantId `plant-b`
- `operatorA`: role `Operador`, plantId `plant-a`

Create equipment:

- `equipmentA`: plantId `plant-a`
- `equipmentB`: plantId `plant-b`

## Expected results

| Actor | Operation | Target | Expected |
|---|---|---|---|
| Admin | read | equipmentA | ALLOW |
| Admin | read | equipmentB | ALLOW |
| Supervisor A | read | equipmentA | ALLOW |
| Supervisor A | read | equipmentB | DENY |
| Supervisor A | create | plant-a | ALLOW |
| Supervisor A | create | plant-b | DENY |
| Supervisor A | update | equipmentA, keep plant-a | ALLOW |
| Supervisor A | update | equipmentA -> plant-b | DENY |
| Supervisor A | delete | equipmentA | ALLOW |
| Supervisor A | delete | equipmentB | DENY |
| Operator A | create | plant-a | DENY |
| Operator A | update | equipmentA | DENY |
| Operator A | delete | equipmentA | DENY |

## Important pre-merge check

Do not deploy these equipment Rules to production until all cases above pass in the Firebase Emulator. The application-level `EquipmentService` query is a complementary filter; the Rules are the authoritative authorization boundary.
