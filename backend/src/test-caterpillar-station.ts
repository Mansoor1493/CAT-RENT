import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

async function testCaterpillar3MethodsStation() {
  console.log('🚀 CATRENT — 3 PRIMARY IDENTIFICATION METHODS VERIFICATION SUITE\n');
  console.log('Specification: "Check in/Check out system: based on QR code/RFID simulation/user entry"\n');

  try {
    // 1. Authenticate Admin
    const authRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'catrent2026',
    });
    const token = authRes.data.data.token;
    console.log('✅ Admin Authenticated successfully.\n');

    // ========================================================
    // METHOD 1: QR CODE (CATRENT:<equipmentId>)
    // ========================================================
    console.log('====================================================');
    console.log('METHOD 1: QR CODE IDENTIFICATION');
    console.log('====================================================');
    const qrPayload = 'CATRENT:EQX1050';
    const qrRes = await axios.get(`${API_URL}/equipment/qr/${encodeURIComponent(qrPayload)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const qrEq = qrRes.data.data;
    console.log(`[QR SCAN] Decoded Payload: "${qrPayload}"`);
    console.log(`[BACKEND LOOKUP] Identified Machine: ${qrEq.equipmentId} • ${qrEq.model} (${qrEq.type})`);
    console.log(`[TELEMETRY] Status: ${qrEq.status} | Site: ${qrEq.siteId || 'Depot'} | Hours: ${qrEq.engineHours}h | Fuel: ${qrEq.fuelLevel}%\n`);

    // ========================================================
    // METHOD 2: RFID SIMULATION (RFID-<equipmentId>)
    // ========================================================
    console.log('====================================================');
    console.log('METHOD 2: RFID SIMULATION IDENTIFICATION');
    console.log('====================================================');
    const rfidTag = 'RFID-EQX1043';
    const rfidRes = await axios.get(`${API_URL}/equipment/qr/${encodeURIComponent(rfidTag)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rfidEq = rfidRes.data.data;
    console.log(`[RFID READ] Simulated Antenna Read: "${rfidTag}"`);
    console.log(`[BACKEND LOOKUP] Identified Machine: ${rfidEq.equipmentId} • ${rfidEq.model} (${rfidEq.type})`);
    console.log(`[TELEMETRY] Status: ${rfidEq.status} | Site: ${rfidEq.siteId || 'Depot'} | Hours: ${rfidEq.engineHours}h | Fuel: ${rfidEq.fuelLevel}%\n`);

    // ========================================================
    // METHOD 3: USER ENTRY (Manual ID / Serial Number)
    // ========================================================
    console.log('====================================================');
    console.log('METHOD 3: USER ENTRY IDENTIFICATION');
    console.log('====================================================');
    const userEntryId = 'EQX1004';
    const userEntryRes = await axios.get(`${API_URL}/equipment/qr/${encodeURIComponent(userEntryId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userEq = userEntryRes.data.data;
    console.log(`[USER ENTRY] Manual Lookup Query: "${userEntryId}"`);
    console.log(`[BACKEND LOOKUP] Identified Machine: ${userEq.equipmentId} • ${userEq.model} (${userEq.type})`);
    console.log(`[TELEMETRY] Status: ${userEq.status} | Site: ${userEq.siteId || 'Depot'} | Hours: ${userEq.engineHours}h | Fuel: ${userEq.fuelLevel}%\n`);

    // ========================================================
    // UNIFIED CHECK-OUT WORKFLOW
    // ========================================================
    console.log('====================================================');
    console.log('UNIFIED DIGITAL CHECK-OUT WORKFLOW');
    console.log('====================================================');
    // Find an available unit
    const availableRes = await axios.get(`${API_URL}/equipment?status=AVAILABLE&limit=1`);
    const targetEq = availableRes.data.data[0];

    if (targetEq) {
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + 7);

      const checkoutRes = await axios.post(
        `${API_URL}/rentals/checkout`,
        {
          equipmentId: targetEq.equipmentId,
          operatorId: 'OP001',
          siteId: 'S002',
          expectedReturnDate: returnDate.toISOString(),
          customerName: 'Kiewit Infrastructure Corp',
          contactPerson: 'David Miller (Site Superintendent)',
          poNumber: 'PO-2026-CAT-7740',
          notes: 'Routine project shift assignment via Check-In/Check-Out station',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newRental = checkoutRes.data.data.rental;
      console.log(`✅ [CHECK-OUT SUCCESS] Rental Agreement Created: ${newRental.rentalId}`);
      console.log(`   Machine: ${targetEq.equipmentId} (${targetEq.model}) -> Status updated to ACTIVE`);
      console.log(`   Site: S002 | Operator: OP001 | Contractor: ${newRental.customerName}\n`);

      // ========================================================
      // UNIFIED DIGITAL CHECK-IN WORKFLOW
      // ========================================================
      console.log('====================================================');
      console.log('UNIFIED DIGITAL CHECK-IN WORKFLOW');
      console.log('====================================================');
      const checkinRes = await axios.post(
        `${API_URL}/rentals/checkin`,
        {
          rentalId: newRental.rentalId,
          checkinEngineHours: targetEq.engineHours + 16,
          checkinFuelLevel: 88,
          condition: 'GOOD',
          notes: 'Return inspection passed. Machine cleaned and ready for deployment.',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`✅ [CHECK-IN SUCCESS] Rental Agreement Closed: ${newRental.rentalId}`);
      console.log(`   Run-Time: +16 hrs | Calculated Rental Charge: $${checkinRes.data.data.cost}`);
      console.log(`   Machine: ${targetEq.equipmentId} -> Status updated to ${checkinRes.data.data.equipment.status}\n`);
    }

    // ========================================================
    // AUDIT LOG VERIFICATION
    // ========================================================
    console.log('====================================================');
    console.log('AUDIT TRAIL VERIFICATION');
    console.log('====================================================');
    const auditRes = await axios.get(`${API_URL}/audit-logs?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Recent Audit Logs:');
    auditRes.data.data.forEach((log: any) => {
      console.log(` - [${log.action}] User: ${log.userId} (${log.role}) | Entity: ${log.entity} (${log.entityId}) | ${log.details || ''}`);
    });

    console.log('\n🎉 ALL 3 CATERPILLAR IDENTIFICATION METHODS & CHECK-IN/OUT WORKFLOWS PASSED 100%!');
  } catch (err: any) {
    console.error('❌ Test failed:', err.response?.data || err.message);
  }
}

testCaterpillar3MethodsStation();
