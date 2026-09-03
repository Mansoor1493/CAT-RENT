import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import {
  User,
  Equipment,
  Site,
  Operator,
  Rental,
  UsageLog,
  LocationLog,
  Alert,
  DemandHistory,
  Forecast,
  Anomaly,
  Recommendation,
  MaintenanceRecord,
  RentalRequest,
  ExtensionRequest,
  AuditLog,
  EquipmentType,
  EquipmentStatus,
} from '../models';

const EQUIPMENT_TYPES: EquipmentType[] = [
  'Excavator',
  'Loader',
  'Dozer',
  'Crane',
  'Dump Truck',
  'Grader',
  'Compactor',
];

const CAT_MODELS: Record<EquipmentType, string[]> = {
  Excavator: ['CAT 320 GC', 'CAT 336 NextGen', 'CAT 349 FL', 'CAT 308 CR Mini'],
  Loader: ['CAT 950M', 'CAT 966M', 'CAT 980M Wheel Loader', 'CAT 906M Compact'],
  Dozer: ['CAT D6T LGP', 'CAT D8T Waste Handler', 'CAT D10T2 Mining', 'CAT D4 Small'],
  Crane: ['CAT TL1255D Telehandler', 'CAT TH514D', 'CAT TL1055D'],
  'Dump Truck': ['CAT 745 Articulated', 'CAT 777G Off-Highway', 'CAT 730 EJ'],
  Grader: ['CAT 140M3 Motor Grader', 'CAT 16M3 Mining Grader', 'CAT 120M2'],
  Compactor: ['CAT CS56B Soil Compactor', 'CAT CB10 Asphalt', 'CAT CW34 Pneumatic'],
};

const SITES_DATA = [
  { siteId: 'S001', name: 'Chennai Industrial Project', address: 'OMR IT & Manufacturing Corridor, Chennai, TN 600119', lat: 13.0827, lng: 80.2707, geofenceRadius: 5.0 },
  { siteId: 'S002', name: 'Bengaluru Infrastructure Project', address: 'Electronic City Phase II, Bengaluru, KA 560100', lat: 12.9716, lng: 77.5946, geofenceRadius: 5.0 },
  { siteId: 'S003', name: 'Hyderabad Construction Project', address: 'HITEC City Metro Extension, Hyderabad, TG 500081', lat: 17.3850, lng: 78.4867, geofenceRadius: 5.0 },
  { siteId: 'S004', name: 'Pune Industrial Project', address: 'Chakan Industrial Area Phase III, Pune, MH 410501', lat: 18.5204, lng: 73.8567, geofenceRadius: 5.0 },
  { siteId: 'S005', name: 'Mumbai Infrastructure Project', address: 'Bandra-Kurla Complex (BKC), Mumbai, MH 400051', lat: 19.0760, lng: 72.8777, geofenceRadius: 5.0 },
  { siteId: 'S006', name: 'Ahmedabad Manufacturing Project', address: 'Sanand Industrial Estate, Ahmedabad, GJ 382110', lat: 23.0225, lng: 72.5714, geofenceRadius: 5.0 },
  { siteId: 'S007', name: 'Delhi NCR Construction Project', address: 'Dwarka Expressway Sector 113, Gurugram / Delhi NCR 122017', lat: 28.6139, lng: 77.2090, geofenceRadius: 5.0 },
  { siteId: 'S008', name: 'Kolkata Infrastructure Project', address: 'New Town Action Area II, Kolkata, WB 700156', lat: 22.5726, lng: 88.3639, geofenceRadius: 5.0 },
];

const OPERATOR_NAMES = [
  'Marcus Vance', 'Sarah Jenkins', 'Carlos Mendez', 'Elena Rostova', 'David Chen',
  'James O’Connor', 'Amina Yusuf', 'Bradley Cooper', 'Maria Santos', 'Tyler Bennett',
  'Hannah Schmidt', 'Lucas Miller', 'Kevin Larson', 'Rachel Adams', 'Jorge Ramirez',
  'Emily Watson', 'Derek Mitchell', 'Chloe Dubois', 'Austin Hayes', 'Vikram Patel'
];

export async function seedDatabase(exitOnComplete: boolean = true): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 1) {
      logger.info('Connecting to MongoDB for seeding...');
      await mongoose.connect(config.mongodbUri);
    }

    logger.info('Cleaning existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Site.deleteMany({}),
      Operator.deleteMany({}),
      Equipment.deleteMany({}),
      Rental.deleteMany({}),
      RentalRequest.deleteMany({}),
      ExtensionRequest.deleteMany({}),
      AuditLog.deleteMany({}),
      UsageLog.deleteMany({}),
      LocationLog.deleteMany({}),
      Alert.deleteMany({}),
      DemandHistory.deleteMany({}),
      Forecast.deleteMany({}),
      Anomaly.deleteMany({}),
      Recommendation.deleteMany({}),
      MaintenanceRecord.deleteMany({}),
    ]);

    // 1. Seed Users (Standard Accounts & Demo Roles)
    logger.info('Seeding Users...');
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('catrent2026', salt);

    const users = [
      // Standard Required Accounts
      {
        userId: 'USR-CUST-001',
        email: 'customer@example.com',
        passwordHash: defaultPassword,
        name: 'John Doe (Apex Contracting)',
        role: 'CUSTOMER',
        companyName: 'Apex Contracting LLC',
        phone: '+1 (303) 555-0199',
      },
      {
        userId: 'USR-ADMIN-001',
        email: 'admin@example.com',
        passwordHash: defaultPassword,
        name: 'Alex Mercer (Admin)',
        role: 'ADMIN',
        companyName: 'CatRent Headquarters',
      },
      {
        userId: 'USR-SITE-001',
        email: 'manager@example.com',
        passwordHash: defaultPassword,
        name: 'Frank Reynolds (Site Superintendent)',
        role: 'SITE_MANAGER',
        assignedSiteIds: ['S002', 'S005'],
        companyName: 'India Fleet Operations - Western Region',
      },
      // Additional Demo Accounts
      {
        userId: 'USR001',
        email: 'admin@catrent.io',
        passwordHash: defaultPassword,
        name: 'Alex Mercer (Admin)',
        role: 'ADMIN',
      },
      {
        userId: 'USR002',
        email: 'manager@catrent.io',
        passwordHash: defaultPassword,
        name: 'Jordan Hayes (Fleet Mgr)',
        role: 'RENTAL_MANAGER',
      },
      {
        userId: 'USR003',
        email: 'sitemgr@catrent.io',
        passwordHash: defaultPassword,
        name: 'Frank Reynolds (Site Mgr S002)',
        role: 'SITE_MANAGER',
        assignedSiteIds: ['S002', 'S005'],
      },
      {
        userId: 'USR004',
        email: 'operator@catrent.io',
        passwordHash: defaultPassword,
        name: 'Marcus Vance (Operator)',
        role: 'OPERATOR',
      },
      {
        userId: 'USR-CUST-002',
        email: 'customer@catrent.io',
        passwordHash: defaultPassword,
        name: 'David Miller (Kiewit Infrastructure)',
        role: 'CUSTOMER',
        companyName: 'Kiewit Infrastructure Corp',
      },
    ];
    await User.insertMany(users);

    // 2. Seed Sites
    logger.info('Seeding Sites...');
    const siteDocs = await Site.insertMany(
      SITES_DATA.map((s) => ({ ...s, activeRentals: 0, status: 'ACTIVE' }))
    );

    // 3. Seed Operators
    logger.info('Seeding Operators...');
    const operatorsData = OPERATOR_NAMES.map((name, idx) => {
      const opId = `OP${(idx + 1).toString().padStart(3, '0')}`;
      const numQuals = (idx % 3) + 2;
      const quals = [...EQUIPMENT_TYPES].sort(() => 0.5 - Math.random()).slice(0, numQuals);
      return {
        operatorId: opId,
        name,
        email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@contractor.catrent.io`,
        phone: `+1 (303) 555-${(1000 + idx).toString()}`,
        qualification: quals,
        status: idx < 12 ? 'ASSIGNED' : 'AVAILABLE',
        assignedSiteId: idx < 12 ? SITES_DATA[idx % SITES_DATA.length].siteId : null,
      };
    });
    const operatorDocs = await Operator.insertMany(operatorsData);

    // 4. Seed Equipment
    logger.info('Seeding Equipment Fleet...');
    const equipmentData: any[] = [];
    let eqCounter = 1001;

    // Guaranteed seed records matching problem statement examples:
    // EQX1001: Active Excavator at S002
    // EQX1002: Anomalous Excavator (Excessive idle, no operator)
    // EQX1003: Overdue Loader at S001
    // EQX1004, EQX1007: Under-utilized candidates for reallocation
    const specificAssets = [
      { id: 'EQX1001', type: 'Excavator', model: 'CAT 336 NextGen', siteId: 'S002', status: 'ACTIVE', opId: 'OP001', engHrs: 2450, opHrs: 1800, idleHrs: 650, fuel: 82, health: 94 },
      { id: 'EQX1002', type: 'Excavator', model: 'CAT 320 GC', siteId: 'S001', status: 'IDLE', opId: null, engHrs: 3120, opHrs: 400, idleHrs: 2720, fuel: 18, health: 68 }, // anomaly!
      { id: 'EQX1003', type: 'Loader', model: 'CAT 966M', siteId: 'S001', status: 'OVERDUE', opId: 'OP002', engHrs: 1890, opHrs: 1540, idleHrs: 350, fuel: 45, health: 88 }, // overdue!
      { id: 'EQX1004', type: 'Excavator', model: 'CAT 320 GC', siteId: 'S007', status: 'AVAILABLE', opId: null, engHrs: 820, opHrs: 600, idleHrs: 220, fuel: 95, health: 96 }, // candidate for S002
      { id: 'EQX1005', type: 'Dozer', model: 'CAT D8T Waste Handler', siteId: 'S006', status: 'ACTIVE', opId: 'OP003', engHrs: 4500, opHrs: 3800, idleHrs: 700, fuel: 65, health: 91 },
      { id: 'EQX1006', type: 'Dump Truck', model: 'CAT 745 Articulated', siteId: 'S002', status: 'ACTIVE', opId: 'OP004', engHrs: 1980, opHrs: 1650, idleHrs: 330, fuel: 74, health: 92 },
      { id: 'EQX1007', type: 'Excavator', model: 'CAT 349 FL', siteId: 'S004', status: 'AVAILABLE', opId: null, engHrs: 1100, opHrs: 850, idleHrs: 250, fuel: 90, health: 95 }, // candidate for S002
    ];

    for (const sa of specificAssets) {
      const site = SITES_DATA.find((s) => s.siteId === sa.siteId) || SITES_DATA[0];
      const jitterLat = site.lat + (Math.random() - 0.5) * 0.02;
      const jitterLng = site.lng + (Math.random() - 0.5) * 0.02;

      equipmentData.push({
        equipmentId: sa.id,
        type: sa.type,
        model: sa.model,
        serialNumber: `CAT-${sa.type.substring(0, 3).toUpperCase()}-${sa.id}`,
        status: sa.status as EquipmentStatus,
        siteId: sa.siteId,
        operatorId: sa.opId,
        lat: jitterLat,
        lng: jitterLng,
        engineHours: sa.engHrs,
        operatingHours: sa.opHrs,
        idleHours: sa.idleHrs,
        fuelLevel: sa.fuel,
        healthScore: sa.health,
        qrCode: `CATRENT-QR-${sa.id}`,
        qrPayload: `CATFLEET:${sa.id}`,
        qrVersion: 1,
        temperature: sa.id === 'EQX1005' ? 96 : sa.id === 'EQX1002' ? 74 : 82,
        yearManufactured: 2021 + (Math.floor(Math.random() * 4)),
        hourlyRate: sa.type === 'Excavator' ? 180 : sa.type === 'Crane' ? 220 : 140,
      });
      eqCounter++;
    }

    // Generate remaining fleet up to 60 units
    const statuses: EquipmentStatus[] = [
      'AVAILABLE', 'AVAILABLE', 'AVAILABLE',
      'RENTED', 'ACTIVE', 'ACTIVE', 'ACTIVE',
      'IDLE', 'IN_TRANSIT', 'MAINTENANCE', 'UNASSIGNED'
    ];

    while (equipmentData.length < 60) {
      const type = EQUIPMENT_TYPES[equipmentData.length % EQUIPMENT_TYPES.length];
      const models = CAT_MODELS[type];
      const model = models[Math.floor(Math.random() * models.length)];
      const id = `EQX${eqCounter++}`;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const site = SITES_DATA[Math.floor(Math.random() * SITES_DATA.length)];
      const assignedOp = ['ACTIVE', 'RENTED'].includes(status)
        ? operatorDocs[Math.floor(Math.random() * operatorDocs.length)].operatorId
        : null;

      const totalEng = 500 + Math.floor(Math.random() * 4500);
      const idleRatio = status === 'IDLE' ? 0.6 + Math.random() * 0.3 : 0.15 + Math.random() * 0.25;
      const opHrs = Math.floor(totalEng * (1 - idleRatio));
      const idleHrs = totalEng - opHrs;

      equipmentData.push({
        equipmentId: id,
        type,
        model,
        serialNumber: `CAT-${type.substring(0, 3).toUpperCase()}-${id}`,
        status,
        siteId: status === 'UNASSIGNED' ? null : site.siteId,
        operatorId: assignedOp,
        lat: site.lat + (Math.random() - 0.5) * 0.03,
        lng: site.lng + (Math.random() - 0.5) * 0.03,
        engineHours: totalEng,
        operatingHours: opHrs,
        idleHours: idleHrs,
        fuelLevel: 40 + Math.floor(Math.random() * 60),
        healthScore: 75 + Math.floor(Math.random() * 25),
        qrCode: `CATRENT-QR-${id}`,
        qrPayload: `CATFLEET:${id}`,
        qrVersion: 1,
        temperature: 78 + Math.floor(Math.random() * 14),
        yearManufactured: 2020 + (Math.floor(Math.random() * 5)),
        hourlyRate: type === 'Excavator' ? 180 : type === 'Crane' ? 220 : 140,
      });
    }

    const equipmentDocs = await Equipment.insertMany(equipmentData);

    // 5. Seed Rentals
    logger.info('Seeding Rentals...');
    const CUSTOMER_ENTERPRISES = [
      'Kiewit Infrastructure Corp',
      'Turner Construction Company',
      'Bechtel Mining & Metals',
      'Skanska USA Civil',
      'Mortenson Construction',
      'Granite Construction Inc.',
      'Balfour Beatty US',
      'Fluor Heavy Industrial',
      'PCL Civil Constructors',
      'Flatiron Construction Corp',
    ];

    const rentalsData: any[] = [];
    const now = new Date();

    // Specific Overdue Rental for EQX1003
    const overdueExpected = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const overdueCheckout = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    rentalsData.push({
      rentalId: 'RNT1001',
      equipmentId: 'EQX1003',
      operatorId: 'OP002',
      siteId: 'S001',
      checkoutDate: overdueCheckout,
      expectedReturnDate: overdueExpected,
      actualReturnDate: null,
      status: 'OVERDUE',
      checkoutEngineHours: 1700,
      checkoutFuelLevel: 100,
      rentalCost: 1890 * 140,
      extensionCount: 1,
      customerName: 'Kiewit Infrastructure Corp',
      contactPerson: 'David Miller (Site Superintendent)',
      poNumber: 'PO-2026-CAT-1001',
      checkedOutBy: 'USR002',
    });

    // Active rentals
    const activeEquipment = equipmentDocs.filter((e) => ['ACTIVE', 'RENTED'].includes(e.status));
    activeEquipment.forEach((eq, idx) => {
      const coDate = new Date(now.getTime() - (2 + (idx % 10)) * 24 * 60 * 60 * 1000);
      const retDate = new Date(now.getTime() + (3 + (idx % 14)) * 24 * 60 * 60 * 1000);

      rentalsData.push({
        rentalId: `RNT${(1002 + idx).toString()}`,
        equipmentId: eq.equipmentId,
        operatorId: eq.operatorId || 'OP001',
        siteId: eq.siteId || 'S001',
        checkoutDate: coDate,
        expectedReturnDate: retDate,
        actualReturnDate: null,
        status: 'ACTIVE',
        checkoutEngineHours: Math.max(0, eq.engineHours - 120),
        checkoutFuelLevel: 100,
        rentalCost: 0,
        extensionCount: 0,
        customerName: CUSTOMER_ENTERPRISES[idx % CUSTOMER_ENTERPRISES.length],
        contactPerson: `${OPERATOR_NAMES[(idx * 3) % OPERATOR_NAMES.length]} (Project Lead)`,
        poNumber: `PO-2026-CAT-${1002 + idx}`,
        checkedOutBy: 'USR002',
      });
    });

    // Historical completed rentals
    for (let i = 0; i < 35; i++) {
      const eq = equipmentDocs[i % equipmentDocs.length];
      const startDaysAgo = 30 + i * 4;
      const durationDays = 5 + (i % 12);
      const coDate = new Date(now.getTime() - startDaysAgo * 24 * 60 * 60 * 1000);
      const retDate = new Date(coDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      rentalsData.push({
        rentalId: `RNT${(2000 + i).toString()}`,
        equipmentId: eq.equipmentId,
        operatorId: operatorDocs[i % operatorDocs.length].operatorId,
        siteId: SITES_DATA[i % SITES_DATA.length].siteId,
        checkoutDate: coDate,
        expectedReturnDate: retDate,
        actualReturnDate: retDate,
        status: 'COMPLETED',
        checkoutEngineHours: Math.max(0, eq.engineHours - 300),
        checkinEngineHours: Math.max(0, eq.engineHours - 300) + durationDays * 8,
        checkoutFuelLevel: 100,
        checkinFuelLevel: 85,
        rentalCost: durationDays * 8 * eq.hourlyRate,
        extensionCount: 0,
        customerName: CUSTOMER_ENTERPRISES[i % CUSTOMER_ENTERPRISES.length],
        contactPerson: `${OPERATOR_NAMES[(i * 2) % OPERATOR_NAMES.length]} (Lead)`,
        poNumber: `PO-2026-CAT-${2000 + i}`,
        checkinNotes: 'Completed shift. Normal wear, routine inspection passed.',
        checkedOutBy: 'USR002',
        checkedInBy: 'USR002',
      });
    }

    await Rental.insertMany(rentalsData);

    // Update activeRentals count on Sites
    for (const site of SITES_DATA) {
      const count = await Rental.countDocuments({ siteId: site.siteId, status: { $in: ['ACTIVE', 'OVERDUE'] } });
      await Site.updateOne({ siteId: site.siteId }, { activeRentals: count });
    }

    // 6. Seed Demand History (6 months of daily records for ML forecasting)
    logger.info('Seeding 180 Days of Demand History for ML Forecasting...');
    const demandHistoryData: any[] = [];
    const startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    for (let day = 0; day < 180; day++) {
      const curDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const dayOfWeek = curDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      for (const site of SITES_DATA) {
        for (const type of EQUIPMENT_TYPES) {
          // Base demand pattern: Site S002 (Highway Expansion) has surging Excavator & Loader demand
          let baseDemand = 2 + Math.floor(Math.random() * 3);
          if (site.siteId === 'S002' && type === 'Excavator') {
            // Upward trend reaching 8-10 units recently
            const trend = (day / 180) * 5;
            baseDemand = Math.floor(4 + trend + (Math.sin(day / 10) * 1.5));
          } else if (site.siteId === 'S006' && type === 'Dozer') {
            baseDemand = 5 + Math.floor(Math.random() * 4);
          }

          if (isWeekend) baseDemand = Math.max(1, Math.floor(baseDemand * 0.4));

          const active = Math.min(baseDemand, 4 + (day % 3));
          const returned = Math.max(0, Math.floor(Math.random() * 2));
          const util = isWeekend ? 25 + Math.random() * 15 : 65 + Math.random() * 30;

          demandHistoryData.push({
            date: curDate,
            siteId: site.siteId,
            equipmentType: type,
            demand: baseDemand,
            rentals: active,
            returns: returned,
            utilization: Math.round(util * 10) / 10,
          });
        }
      }
    }
    await DemandHistory.insertMany(demandHistoryData);

    // 7. Seed Usage Logs (30 days of telemetry history for each equipment)
    logger.info('Seeding Usage Logs...');
    const usageLogsData: any[] = [];
    const locationLogsData: any[] = [];

    for (const eq of equipmentDocs) {
      const isAnomalous = eq.equipmentId === 'EQX1002';
      const site = SITES_DATA.find((s) => s.siteId === eq.siteId) || SITES_DATA[0];

      for (let day = 0; day < 30; day++) {
        const date = new Date(now.getTime() - (29 - day) * 24 * 60 * 60 * 1000);
        let dailyOp = isAnomalous ? 1.2 : 5.5 + Math.random() * 3.5;
        let dailyIdle = isAnomalous ? 7.8 : 1.2 + Math.random() * 1.8;
        let fuel = dailyOp * (14 + Math.random() * 4);

        usageLogsData.push({
          equipmentId: eq.equipmentId,
          date,
          engineHours: Math.round((dailyOp + dailyIdle) * 10) / 10,
          operatingHours: Math.round(dailyOp * 10) / 10,
          idleHours: Math.round(dailyIdle * 10) / 10,
          fuelConsumed: Math.round(fuel * 10) / 10,
          lat: site.lat + (Math.random() - 0.5) * 0.015,
          lng: site.lng + (Math.random() - 0.5) * 0.015,
          siteId: eq.siteId,
          operatorId: eq.operatorId,
        });

        // Location logs (sampled)
        if (day >= 25) {
          locationLogsData.push({
            equipmentId: eq.equipmentId,
            timestamp: new Date(date.getTime() + 14 * 3600 * 1000),
            lat: site.lat + (Math.random() - 0.5) * 0.01,
            lng: site.lng + (Math.random() - 0.5) * 0.01,
            speed: eq.status === 'ACTIVE' ? Math.round(8 + Math.random() * 18) : 0,
            siteId: eq.siteId,
          });
        }
      }
    }
    await UsageLog.insertMany(usageLogsData);
    await LocationLog.insertMany(locationLogsData);

    // 8. Seed Anomalies (with explainability)
    logger.info('Seeding Anomalies...');
    const anomaliesData = [
      {
        equipmentId: 'EQX1002',
        score: 0.89,
        severity: 'CRITICAL',
        reasons: [
          'Idle hours (2,720h) is 2.8x higher than fleet average',
          'Utilization is critically low at 12.8% over last 30 days',
          'No operator assigned while placed on active project site',
          'Fuel level critically low (18%) with engine idling detected',
        ],
        status: 'ACTIVE',
        detectionMethod: 'ML_BASED',
      },
      {
        equipmentId: 'EQX1003',
        score: 0.82,
        severity: 'HIGH',
        reasons: [
          'Rental return date is overdue by 3 days',
          'Daily engine hours exceeded agreed rental shift limit by 4.2h/day',
          'Location mismatch: telemetry active outside designated S001 boundary',
        ],
        status: 'ACTIVE',
        detectionMethod: 'RULE_BASED',
      },
      {
        equipmentId: 'EQX1015',
        score: 0.65,
        severity: 'MEDIUM',
        reasons: [
          'Unusual fuel consumption spike (+42% vs model baseline)',
          'Operating temperature thermal delta variance flagged by Isolation Forest',
        ],
        status: 'ACTIVE',
        detectionMethod: 'ML_BASED',
      },
    ];
    await Anomaly.insertMany(anomaliesData);

    // 9. Seed Alerts
    logger.info('Seeding Alerts...');
    const todayKey = now.toISOString().split('T')[0];
    const alertsData = [
      {
        alertId: 'ALT1001',
        alertKey: `OVERDUE:EQX1003:${todayKey}`,
        type: 'OVERDUE',
        title: 'RENTAL AGREEMENT OVERDUE',
        equipmentId: 'EQX1003',
        siteId: 'S001',
        severity: 'HIGH',
        message: 'Rental agreement RNT1001 is OVERDUE by 3 days. Expected return was Sep 01, 2026.',
        currentValue: '3 days overdue',
        threshold: '0 days',
        recommendation: 'Contact operator Sarah Jenkins (OP002) or process digital check-in.',
        isRead: false,
        status: 'ACTIVE',
      },
      {
        alertId: 'ALT1002',
        alertKey: `HIGH_IDLE:EQX1002:${todayKey}`,
        type: 'HIGH_IDLE',
        title: 'SEVERE IDLE RATIO DETECTED',
        equipmentId: 'EQX1002',
        siteId: 'S001',
        severity: 'HIGH',
        message: 'Machine idle ratio reached 88.0% (2,720 idle hrs), significantly above operational threshold of 70%.',
        currentValue: '88.0%',
        threshold: '70.0%',
        recommendation: 'Investigate quarry job site delays or consider reallocation to S002 highway expansion.',
        isRead: false,
        status: 'ACTIVE',
      },
      {
        alertId: 'ALT1003',
        alertKey: `MACHINE_OVERUSE:EQX1005:${todayKey}`,
        type: 'MACHINE_OVERUSE',
        title: 'CRITICAL MACHINE OVERUSE',
        equipmentId: 'EQX1005',
        siteId: 'S006',
        severity: 'CRITICAL',
        message: 'Operating time is 10.7 hrs today, exceeding recommended 8 hrs/day by 2.7 hrs.',
        currentValue: '10.7 hrs/day',
        threshold: '8.0 hrs/day',
        recommendation: 'Immediate shift pause required. Rotate operator and perform engine cooling inspection.',
        isRead: false,
        status: 'ACTIVE',
      },
      {
        alertId: 'ALT1004',
        alertKey: `UNDER_UTILIZED:EQX1004:${todayKey}`,
        type: 'UNDER_UTILIZED',
        title: 'UNDER-UTILIZED ASSET CANDIDATE',
        equipmentId: 'EQX1004',
        siteId: 'S007',
        severity: 'WARNING',
        message: 'Asset utilization is only 24.0% while idle at S007. Candidate for autonomous dispatch.',
        currentValue: '24.0%',
        threshold: '30.0%',
        recommendation: 'Execute recommended reallocation to Site S002.',
        isRead: true,
        status: 'ACTIVE',
      },
      {
        alertId: 'ALT1005',
        alertKey: `TEMPERATURE_HIGH:EQX1015:${todayKey}`,
        type: 'TEMPERATURE_HIGH',
        title: 'ENGINE TEMPERATURE ELEVATED',
        equipmentId: 'EQX1015',
        siteId: 'S003',
        severity: 'WARNING',
        message: 'Engine coolant temperature recorded at 94.2°C, above standard 90°C baseline.',
        currentValue: '94.2°C',
        threshold: '90.0°C',
        recommendation: 'Monitor thermal telemetry and inspect hydraulic cooling fans.',
        isRead: false,
        status: 'ACTIVE',
      },
    ];
    await Alert.insertMany(alertsData);

    // 10. Seed Initial Forecasts & Recommendations for ALL sites and ALL equipment types
    logger.info('Seeding Forecasts & Reallocation Recommendations for all categories...');
    const forecastDates = ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08'];
    const forecastData: any[] = [];

    for (const site of SITES_DATA) {
      for (const eqType of EQUIPMENT_TYPES) {
        const availableInDb = equipmentDocs.filter(
          (e) => e.siteId === site.siteId && e.type === eqType
        ).length;

        const baseDemand =
          eqType === 'Excavator'
            ? (site.siteId === 'S002' ? 8 : 5)
            : eqType === 'Dozer'
            ? (site.siteId === 'S002' ? 7 : 5)
            : eqType === 'Loader'
            ? 6
            : eqType === 'Dump Truck'
            ? 8
            : eqType === 'Crane'
            ? 4
            : 5;

        forecastDates.forEach((fDate, i) => {
          const demandVal = Math.max(
            1,
            Math.round((baseDemand + (i % 3) * 0.8 + ((i * 3) % 2) * 0.5) * 10) / 10
          );
          const avail = Math.max(1, availableInDb || 2);
          const shortageRisk =
            demandVal > avail * 1.3 ? 'HIGH' : demandVal > avail ? 'MEDIUM' : 'LOW';

          forecastData.push({
            siteId: site.siteId,
            equipmentType: eqType,
            forecastDate: fDate,
            predictedDemand: demandVal,
            confidence: Math.round((0.85 + ((i * 7) % 8) * 0.01) * 100) / 100,
            shortageRisk,
            available: avail,
          });
        });
      }
    }
    await Forecast.insertMany(forecastData);

    const recommendationData = [
      {
        recommendationId: 'REC1001',
        action: 'REALLOCATE' as const,
        sourceEquipmentIds: ['EQX1004', 'EQX1007'],
        sourceSiteId: 'S007',
        targetSiteId: 'S002',
        equipmentType: 'Excavator' as EquipmentType,
        reasons: [
          'Metro West Highway Expansion (S002) predicted demand: 8 units (Current available: 3)',
          'High shortage risk of 5 Excavators projected for upcoming week',
          'Candidate EQX1004 (S007) is under-utilized (<18% utilization, 42 km distance)',
          'Candidate EQX1007 (S004) is available with 95% health score (55 km distance)',
          'Pre-positioning avoids estimated $7,200 project delay & emergency rush rental premiums',
        ],
        expectedImpact: {
          utilizationGain: 46.5,
          shortageCoverage: 100,
          costSaving: 7200,
        },
        score: 92.4,
        status: 'PENDING' as const,
      },
    ];
    await Recommendation.insertMany(recommendationData);

    // 11. Seed Rental Requests (Customer Submissions & Approval States)
    logger.info('Seeding Rental Requests...');
    const currentSeedTime = new Date();
    const inTwoDays = new Date(currentSeedTime.getTime() + 2 * 24 * 60 * 60 * 1000);
    const inSevenDays = new Date(currentSeedTime.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inThreeDays = new Date(currentSeedTime.getTime() + 3 * 24 * 60 * 60 * 1000);
    const inTenDays = new Date(currentSeedTime.getTime() + 10 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(currentSeedTime.getTime() - 5 * 24 * 60 * 60 * 1000);
    const inFiveDays = new Date(currentSeedTime.getTime() + 5 * 24 * 60 * 60 * 1000);
    const inTwelveDays = new Date(currentSeedTime.getTime() + 12 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(currentSeedTime.getTime() - 10 * 24 * 60 * 60 * 1000);

    const rentalRequestsData = [
      {
        requestId: 'RR1024',
        customerId: 'USR-CUST-001',
        customerName: 'John Doe (Apex Contracting)',
        customerEmail: 'customer@example.com',
        equipmentId: 'EQX1004',
        siteId: 'S002',
        startDate: inTwoDays,
        expectedReturnDate: inSevenDays,
        estimatedCost: 7200,
        purpose: 'Highway Expansion earthmoving shift 2',
        notes: 'Requires dual-tilt bucket attachment if available',
        status: 'PENDING_APPROVAL' as const,
      },
      {
        requestId: 'RR1025',
        customerId: 'USR-CUST-001',
        customerName: 'John Doe (Apex Contracting)',
        customerEmail: 'customer@example.com',
        equipmentId: 'EQX1005',
        siteId: 'S001',
        startDate: inThreeDays,
        expectedReturnDate: inTenDays,
        estimatedCost: 15400,
        purpose: 'Quarry aggregate leveling and grading',
        notes: 'Operator certified for CAT D8T heavy class',
        status: 'PENDING_APPROVAL' as const,
      },
      {
        requestId: 'RR1020',
        customerId: 'USR-CUST-002',
        customerName: 'David Miller (Kiewit Infrastructure)',
        customerEmail: 'customer@catrent.io',
        equipmentId: 'EQX1001',
        siteId: 'S002',
        startDate: fiveDaysAgo,
        expectedReturnDate: inFiveDays,
        estimatedCost: 11200,
        purpose: 'Metro West Bridge footing excavation',
        status: 'APPROVED' as const,
        approvedBy: 'USR-ADMIN-001',
        approvedAt: fiveDaysAgo,
        rentalId: 'RNT001',
      },
      {
        requestId: 'RR1015',
        customerId: 'USR-CUST-001',
        customerName: 'John Doe (Apex Contracting)',
        customerEmail: 'customer@example.com',
        equipmentId: 'EQX1003',
        siteId: 'S004',
        startDate: tenDaysAgo,
        expectedReturnDate: fiveDaysAgo,
        estimatedCost: 6400,
        purpose: 'Logistics hub warehouse foundation',
        status: 'REJECTED' as const,
        rejectedBy: 'USR-ADMIN-001',
        rejectedAt: tenDaysAgo,
        rejectionReason: 'Machine scheduled for mandatory factory hydraulic overhaul',
      },
    ];
    await RentalRequest.insertMany(rentalRequestsData);

    // 12. Seed Extension Requests
    logger.info('Seeding Extension Requests...');
    const extensionRequestsData = [
      {
        extensionId: 'EXT101',
        rentalId: 'RNT001',
        customerId: 'USR-CUST-002',
        equipmentId: 'EQX1001',
        currentReturnDate: inFiveDays,
        requestedReturnDate: inTwelveDays,
        reason: 'Foundation excavation extended due to bedrock encounter (+7 Days)',
        status: 'PENDING_APPROVAL' as const,
      },
    ];
    await ExtensionRequest.insertMany(extensionRequestsData);

    // 13. Seed Initial Audit Logs
    logger.info('Seeding Audit Logs...');
    const auditLogsData = [
      {
        userId: 'USR-ADMIN-001',
        role: 'ADMIN',
        action: 'SYSTEM_BOOT',
        entity: 'SYSTEM',
        entityId: 'CATRENT-CORE',
        newValue: { status: 'ONLINE', fleetAssets: 60, sites: 8 },
        details: 'CatRent Enterprise System initialized with multi-role RBAC',
      },
      {
        userId: 'USR-CUST-001',
        role: 'CUSTOMER',
        action: 'RENTAL_REQUEST_CREATED',
        entity: 'RENTAL_REQUEST',
        entityId: 'RR1024',
        newValue: { equipmentId: 'EQX1004', siteId: 'S002', cost: 7200 },
        details: 'Customer John Doe submitted rental request for CAT 320 GC (EQX1004)',
      },
      {
        userId: 'USR-ADMIN-001',
        role: 'ADMIN',
        action: 'RENTAL_REQUEST_APPROVED',
        entity: 'RENTAL_REQUEST',
        entityId: 'RR1020',
        previousValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'APPROVED', rentalId: 'RNT001' },
        details: 'Admin Alex Mercer approved rental request RR1020 for EQX1001',
      },
    ];
    await AuditLog.insertMany(auditLogsData);

    logger.info('Database seeding completed successfully!');
    logger.info(`Seeded:
      - ${users.length} Users
      - ${siteDocs.length} Sites
      - ${operatorDocs.length} Operators
      - ${equipmentDocs.length} Equipment Assets
      - ${rentalsData.length} Rentals
      - ${rentalRequestsData.length} Rental Requests
      - ${extensionRequestsData.length} Extension Requests
      - ${auditLogsData.length} Audit Logs
      - ${demandHistoryData.length} Demand History Records (180 days)
      - ${usageLogsData.length} Usage Logs
      - ${locationLogsData.length} Location Logs
      - ${anomaliesData.length} Anomalies
      - ${alertsData.length} Alerts
      - ${forecastData.length} Forecasts
      - ${recommendationData.length} Recommendations
    `);

    if (exitOnComplete) {
      process.exit(0);
    }
  } catch (error) {
    logger.error('Error during database seed:', error);
    if (exitOnComplete) {
      process.exit(1);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase(true);
}

