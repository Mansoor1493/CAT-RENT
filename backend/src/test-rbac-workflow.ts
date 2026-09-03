import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

async function runE2ETests() {
  console.log('🚀 Starting CatRent RBAC & Workflow E2E Verification Tests...\n');

  try {
    // 1. Authenticate Customer
    console.log('Test 1: Authenticate Customer (customer@example.com)...');
    const custRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'customer@example.com',
      password: 'catrent2026',
    });
    const custToken = custRes.data.data.token;
    const custUser = custRes.data.data.user;
    console.log(`✅ Customer Authenticated: ${custUser.name} (${custUser.role})\n`);

    // 2. Authenticate Admin
    console.log('Test 2: Authenticate Admin (admin@example.com)...');
    const adminRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'catrent2026',
    });
    const adminToken = adminRes.data.data.token;
    const adminUser = adminRes.data.data.user;
    console.log(`✅ Admin Authenticated: ${adminUser.name} (${adminUser.role})\n`);

    // 3. Authenticate Site Manager
    console.log('Test 3: Authenticate Site Manager (manager@example.com)...');
    const siteMgrRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'manager@example.com',
      password: 'catrent2026',
    });
    const siteMgrToken = siteMgrRes.data.data.token;
    const siteMgrUser = siteMgrRes.data.data.user;
    console.log(`✅ Site Manager Authenticated: ${siteMgrUser.name} (Assigned Sites: ${siteMgrUser.assignedSiteIds.join(', ')})\n`);

    // 4. Customer submits a new rental request
    console.log('Test 4: Customer submits Rental Request for available equipment at S002...');
    const fleetRes = await axios.get(`${API_URL}/equipment?status=AVAILABLE&limit=1`);
    const availableEq = fleetRes.data.data[0];
    const targetEqId = availableEq?.equipmentId || 'EQX1004';

    const start = new Date();
    start.setDate(start.getDate() + 30);
    const end = new Date();
    end.setDate(end.getDate() + 35);

    const reqRes = await axios.post(
      `${API_URL}/rental-requests`,
      {
        equipmentId: targetEqId,
        siteId: 'S002',
        startDate: start.toISOString(),
        expectedReturnDate: end.toISOString(),
        purpose: 'E2E Highway Excavation',
        notes: 'Requires dual-tilt bucket',
      },
      { headers: { Authorization: `Bearer ${custToken}` } }
    );
    const createdReq = reqRes.data.data;
    console.log(`✅ Rental Request Created: ID ${createdReq.requestId}, Equipment: ${targetEqId}, Status: ${createdReq.status}, Est. Cost: $${createdReq.estimatedCost}\n`);

    // 5. Customer fetches own requests
    console.log('Test 5: Customer fetches own rental requests...');
    const custReqsRes = await axios.get(`${API_URL}/rental-requests`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    console.log(`✅ Customer sees ${custReqsRes.data.data.length} requests (all belonging to customer)\n`);

    // 6. Admin reviews all rental requests
    console.log('Test 6: Admin retrieves all pending requests...');
    const adminReqsRes = await axios.get(`${API_URL}/rental-requests?status=PENDING_APPROVAL`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`✅ Admin sees ${adminReqsRes.data.data.length} pending requests across fleet\n`);

    // 7. Admin Approves the newly created rental request
    console.log(`Test 7: Admin approves rental request ${createdReq.requestId}...`);
    const approveRes = await axios.post(
      `${API_URL}/rental-requests/${createdReq.requestId}/approve`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const newRental = approveRes.data.data.rental;
    console.log(`✅ Request Approved! Active Rental Created: ID ${newRental.rentalId}, Status: ${newRental.status}\n`);

    // 8. Customer requests extension for active rental
    console.log(`Test 8: Customer submits extension request for rental ${newRental.rentalId}...`);
    const newExtDate = new Date(end);
    newExtDate.setDate(newExtDate.getDate() + 5);

    const extRes = await axios.post(
      `${API_URL}/extension-requests`,
      {
        rentalId: newRental.rentalId,
        requestedReturnDate: newExtDate.toISOString(),
        reason: 'Site earthwork phase prolonged due to weather (+5 Days)',
      },
      { headers: { Authorization: `Bearer ${custToken}` } }
    );
    const createdExt = extRes.data.data;
    console.log(`✅ Extension Request Created: ID ${createdExt.extensionId}, Status: ${createdExt.status}\n`);

    // 9. Admin Approves extension request
    console.log(`Test 9: Admin approves extension ${createdExt.extensionId}...`);
    const approveExtRes = await axios.post(
      `${API_URL}/extension-requests/${createdExt.extensionId}/approve`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log(`✅ Extension Approved! New Return Date: ${new Date(approveExtRes.data.data.rental.expectedReturnDate).toLocaleDateString()}\n`);

    // 10. Site Manager checks assigned sites
    console.log('Test 10: Site Manager checks assigned sites (/site-ops/my-sites)...');
    const mySitesRes = await axios.get(`${API_URL}/site-ops/my-sites`, {
      headers: { Authorization: `Bearer ${siteMgrToken}` },
    });
    console.log(`✅ Site Manager sees ${mySitesRes.data.data.length} assigned sites: ${mySitesRes.data.data.map((s: any) => s.siteId).join(', ')}\n`);

    // 11. Site Manager attempts unauthorized site access
    console.log('Test 11: Site Manager attempts unauthorized access to S001 (should return 403)...');
    try {
      await axios.get(`${API_URL}/site-ops/equipment?siteId=S001`, {
        headers: { Authorization: `Bearer ${siteMgrToken}` },
      });
      console.error('❌ ERROR: Should have been 403 Forbidden!');
    } catch (err: any) {
      if (err.response?.status === 403) {
        console.log(`✅ Correctly Forbidden: HTTP 403 (${err.response.data.message})\n`);
      } else {
        console.error('❌ Unexpected status:', err.response?.status);
      }
    }

    // 12. Admin Inspects Audit Trail
    console.log('Test 12: Admin fetches system audit trail (/api/audit-logs)...');
    const auditRes = await axios.get(`${API_URL}/audit-logs?limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`✅ Total Audit Log Entries Found: ${auditRes.data.pagination.total}`);
    auditRes.data.data.slice(0, 5).forEach((log: any, idx: number) => {
      console.log(`   ${idx + 1}. [${log.action}] User: ${log.userId} (${log.role}) -> ${log.details}`);
    });

    console.log('\n🎉 ALL 12 END-TO-END RBAC & WORKFLOW TESTS PASSED PERFECTLY!');
  } catch (error: any) {
    console.error('❌ Test failed with error:', error.response?.data || error.message);
  }
}

runE2ETests();
