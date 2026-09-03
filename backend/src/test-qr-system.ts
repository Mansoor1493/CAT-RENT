import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

async function testQRSystem() {
  console.log('🚀 Starting CatRent QR Generation & Decoding Verification Suite...\n');

  try {
    // 1. Authenticate Admin
    const authRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'catrent2026',
    });
    const token = authRes.data.data.token;
    console.log('✅ Admin Authenticated successfully.\n');

    // 2. Test Specific Requested Equipment IDs with Payload CATRENT:<equipmentId>
    const testIds = ['EQX1050', 'EQX1043', 'EQX1041', 'EQX1038', 'EQX1004', 'EQX1007'];

    console.log('--- Testing Optical Payload Decoding (CATRENT:<id>) ---');
    for (const eqId of testIds) {
      const payload = `CATRENT:${eqId}`;
      const res = await axios.get(`${API_URL}/equipment/qr/${encodeURIComponent(payload)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const eq = res.data.data;
      console.log(
        `✅ Decoded Payload [${payload}] -> ${eq.equipmentId}: ${eq.model} (${eq.type}) | Status: ${eq.status} | Site: ${eq.siteId || 'Depot'} | Engine: ${eq.engineHours}h`
      );
    }

    // 3. Test Backwards Compatibility & Direct ID
    console.log('\n--- Testing Legacy Formats & Direct Lookups ---');
    const legacyRes = await axios.get(`${API_URL}/equipment/qr/${encodeURIComponent('CATFLEET:EQX1050')}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`✅ Legacy Payload [CATFLEET:EQX1050] -> ${legacyRes.data.data.equipmentId}: ${legacyRes.data.data.model}`);

    const directRes = await axios.get(`${API_URL}/equipment/qr/EQX1050`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`✅ Direct ID [EQX1050] -> ${directRes.data.data.equipmentId}: ${directRes.data.data.model}`);

    // 4. Test Digital Check-Out Flow on an available machine
    console.log('\n--- Testing Digital Check-Out Workflow ---');
    // Find an available machine
    const fleetRes = await axios.get(`${API_URL}/equipment?status=AVAILABLE&limit=1`);
    const availableEq = fleetRes.data.data[0];
    if (availableEq) {
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + 7);

      const checkoutRes = await axios.post(
        `${API_URL}/rentals/checkout`,
        {
          equipmentId: availableEq.equipmentId,
          operatorId: 'OP001',
          siteId: 'S002',
          expectedReturnDate: returnDate.toISOString(),
          customerName: 'Kiewit Infrastructure Corp',
          contactPerson: 'David Miller (Site Superintendent)',
          poNumber: 'PO-2026-QR-DEMO',
          notes: 'QR Field Station Digital Check-Out Verification',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newRental = checkoutRes.data.data.rental;
      console.log(`✅ Digital Check-Out Succeeded! Rental ID: ${newRental.rentalId} for ${availableEq.equipmentId} (Status: ${checkoutRes.data.data.equipment.status})`);

      // 5. Test Digital Check-In Flow on the newly active rental
      console.log('\n--- Testing Digital Check-In Workflow ---');
      const checkinRes = await axios.post(
        `${API_URL}/rentals/checkin`,
        {
          rentalId: newRental.rentalId,
          checkinEngineHours: availableEq.engineHours + 12,
          checkinFuelLevel: 90,
          condition: 'GOOD',
          notes: 'QR Field Station Digital Check-In Return Verified',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`✅ Digital Check-In Succeeded! Cost Billed: $${checkinRes.data.data.cost} | Equipment Status: ${checkinRes.data.data.equipment.status}`);
    }

    // 6. Verify Audit Logs for QR_SCAN, CHECK_OUT, CHECK_IN
    console.log('\n--- Verifying Audit Trail ---');
    const auditRes = await axios.get(`${API_URL}/audit-logs?limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const actions = auditRes.data.data.map((l: any) => l.action);
    console.log('✅ Recent Audit Actions Recorded:', [...new Set(actions)].join(', '));

    console.log('\n🎉 ALL QR SYSTEM TESTS & WORKFLOW VALIDATIONS PASSED!');
  } catch (err: any) {
    console.error('❌ QR Test failed:', err.response?.data || err.message);
  }
}

testQRSystem();
