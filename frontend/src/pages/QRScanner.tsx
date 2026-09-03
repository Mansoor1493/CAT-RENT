import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import QRCode from 'qrcode';
import api from '@/services/api';
import { useStore } from '@/store/useStore';
import { Equipment, Site, Operator, Rental, Alert } from '@/types';
import QRCodeModal from '@/components/common/QRCodeModal';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Truck,
  User,
  MapPin,
  Clock,
  Sparkles,
  FileText,
  Video,
  VideoOff,
  Fuel,
  Gauge,
  Calendar,
  DollarSign,
  Upload,
  Search,
  Check,
  RotateCcw,
  ShieldCheck,
  Building2,
  Radio,
  Waves,
  Download,
  Eye,
  Thermometer,
  HeartPulse,
  Crosshair,
  Target,
  ExternalLink,
  ShieldAlert,
  Info,
  RefreshCw,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';

// EXACT THREE PRIMARY METHODS PER CATERPILLAR SPECIFICATION
type PrimaryStationMethod = 'QR_CODE' | 'RFID_SIMULATION' | 'USER_ENTRY';

const ENTERPRISE_CUSTOMERS = [
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
  'Custom Customer / Individual Renter',
];

interface EnrichedEquipment extends Equipment {
  site?: Site;
  operator?: Operator;
  activeRental?: Rental;
  detectedSite?: { siteId: string; name: string; address?: string };
  siteMatchStatus?: 'MATCHED' | 'OUTSIDE_GEOFENCE' | 'WRONG_SITE' | 'NO_ASSIGNED_SITE';
  distanceFromAssignedSiteKm?: number;
  utilization?: number;
  activeAlerts?: Alert[];
}

export default function QRScannerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useStore((state) => state.user);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastScanTimestampRef = useRef<number>(0);

  // THREE PRIMARY METHODS: QR CODE, RFID SIMULATION, USER ENTRY
  const [activeMethod, setActiveMethod] = useState<PrimaryStationMethod>('QR_CODE');

  // Unified Decoded Machine State
  const [scannedCode, setScannedCode] = useState<string | null>('EQX1001');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeActionTab, setActiveActionTab] = useState<'checkout' | 'checkin' | 'details'>('details');

  // Method 1: QR Code State
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sampleQRsOpen, setSampleQRsOpen] = useState(false);

  // Method 2: RFID Simulation State
  const [rfidSelectedEqId, setRfidSelectedEqId] = useState<string>('EQX1001');
  const [isRfidPulsing, setIsRfidPulsing] = useState<boolean>(false);

  // Method 3: User Entry State
  const [userEntryInput, setUserEntryInput] = useState<string>('EQX1001');

  // Reusable QR Code Modal State
  const [qrModalEquipment, setQrModalEquipment] = useState<Equipment | null>(null);

  // Sample QR Data URLs
  const [sampleQrUrls, setSampleQrUrls] = useState<Record<string, string>>({});

  // Helper for dynamic future date (+7 days)
  const getSevenDaysAhead = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  // Checkout form states
  const [customerName, setCustomerName] = useState('Kiewit Infrastructure Corp');
  const [customCustomerText, setCustomCustomerText] = useState('');
  const [contactPerson, setContactPerson] = useState('David Miller (Site Superintendent)');
  const [poNumber, setPoNumber] = useState('PO-2026-CAT-7740');
  const [selectedOpId, setSelectedOpId] = useState('OP001');
  const [selectedSiteId, setSelectedSiteId] = useState('S002');
  const [expectedReturnDate, setExpectedReturnDate] = useState(getSevenDaysAhead());
  const [checkoutNotes, setCheckoutNotes] = useState('Routine project shift assignment.');

  // Checkin form states
  const [checkinHours, setCheckinHours] = useState<number>(0);
  const [checkinFuel, setCheckinFuel] = useState<number>(85);
  const [checkinCondition, setCheckinCondition] = useState<'GOOD' | 'DAMAGED'>('GOOD');
  const [checkinNotes, setCheckinNotes] = useState('Shift complete. Routine inspection passed.');

  // Fetch all fleet equipment for selectors
  const { data: allEquipmentData } = useQuery<{ success: boolean; data: Equipment[] }>({
    queryKey: ['fleet-all-equipment'],
    queryFn: async () => (await api.get('/equipment?limit=100')).data,
  });

  const allFleet = allEquipmentData?.data || [];

  // Generate QR Data URLs for sample QR viewer
  useEffect(() => {
    if (allFleet.length > 0) {
      const urls: Record<string, string> = {};
      Promise.all(
        allFleet.slice(0, 30).map((asset) => {
          const payload = `CATRENT:${asset.equipmentId}`;
          return QRCode.toDataURL(payload, {
            width: 240,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: { dark: '#000000', light: '#ffffff' },
          }).then((url) => {
            urls[asset.equipmentId] = url;
          });
        })
      ).then(() => {
        setSampleQrUrls(urls);
      });
    }
  }, [allFleet.length]);

  // Unified Backend Equipment Lookup
  const {
    data: scanData,
    isLoading: scanLoading,
    isError: scanIsError,
    error: scanError,
    refetch: refetchEquipment,
  } = useQuery<{
    success: boolean;
    data: EnrichedEquipment;
  }>({
    queryKey: ['qr-scan', scannedCode],
    queryFn: async () => {
      if (!scannedCode) return null as any;
      const res = await api.get(`/equipment/qr/${encodeURIComponent(scannedCode)}`);
      return res.data;
    },
    enabled: !!scannedCode && !validationError,
    retry: 1,
  });

  const { data: sitesData } = useQuery<{ success: boolean; data: Site[] }>({
    queryKey: ['sites-list'],
    queryFn: async () => (await api.get('/sites')).data,
  });

  const { data: operatorsData } = useQuery<{ success: boolean; data: Operator[] }>({
    queryKey: ['operators-list'],
    queryFn: async () => (await api.get('/operators')).data,
  });

  const eq = scanData?.data;
  const sites = sitesData?.data || [];
  const operators = operatorsData?.data || [];

  // Update form defaults & action tabs when equipment loads
  useEffect(() => {
    if (eq) {
      setCheckinHours(eq.engineHours + 8);
      setCheckinFuel(Math.max(10, eq.fuelLevel - 15));
      if (eq.siteId) setSelectedSiteId(eq.siteId);
      if (eq.operatorId) setSelectedOpId(eq.operatorId);

      // Default active tab based on status
      if (eq.status === 'AVAILABLE' || eq.status === 'IDLE') {
        setActiveActionTab('checkout');
      } else if (eq.status === 'ACTIVE' || eq.status === 'OVERDUE') {
        setActiveActionTab('checkin');
      } else {
        setActiveActionTab('details');
      }
    }
  }, [eq?.equipmentId, eq?.status]);

  // Audio Beep generator
  const playScanBeep = (freq: number = 880) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  // Switch Method cleanly
  const handleMethodSwitch = (method: PrimaryStationMethod) => {
    if (isCameraRunning) {
      stopScanner();
    }
    setActiveMethod(method);
    setValidationError(null);
  };

  // ==========================================
  // NORMALIZED QR / RFID / USER ENTRY PIPELINE
  // ==========================================
  const processDecodedPayload = (rawPayload: string, sourceMethod: string) => {
    const trimmed = rawPayload.trim();
    if (!trimmed) {
      setValidationError('Scan input cannot be empty.');
      return;
    }

    let extractedId = trimmed;

    // Pattern matching
    if (trimmed.startsWith('CATRENT:')) {
      extractedId = trimmed.replace(/^CATRENT:/i, '').trim();
    } else if (trimmed.startsWith('CATFLEET:')) {
      extractedId = trimmed.replace(/^CATFLEET:/i, '').trim();
    } else if (trimmed.startsWith('RFID-')) {
      extractedId = trimmed.replace(/^RFID-/i, '').trim();
    } else if (trimmed.startsWith('RFID:')) {
      extractedId = trimmed.replace(/^RFID:/i, '').trim();
    } else if (trimmed.startsWith('EPC-CAT900-')) {
      extractedId = trimmed.replace(/^EPC-CAT900-/i, '').trim();
    } else if (trimmed.startsWith('EPC-')) {
      extractedId = trimmed.replace(/^EPC-/i, '').trim();
    } else {
      const eqMatch = trimmed.match(/EQX\d+/i);
      const catSerialMatch = trimmed.match(/CAT-[A-Z]+-EQX\d+/i);
      if (eqMatch) {
        extractedId = eqMatch[0].toUpperCase();
      } else if (catSerialMatch) {
        extractedId = catSerialMatch[0].toUpperCase();
      } else if (!/^[A-Za-z0-9-_]+$/.test(trimmed)) {
        setValidationError(`Invalid QR format: "${trimmed}". Expected "CATRENT:<equipmentId>" or valid CatRent tag.`);
        setScannedCode(null);
        return;
      }
    }

    if (!extractedId) {
      setValidationError(`Could not extract valid Equipment ID from "${trimmed}".`);
      setScannedCode(null);
      return;
    }

    setValidationError(null);
    setScannedCode(extractedId);
    setScanMessage(`🎯 [${sourceMethod}] Identified: ${extractedId} (Payload: "${trimmed}")`);
    playScanBeep(880);
  };

  // ==========================================
  // 1. QR CODE METHOD HANDLERS
  // ==========================================
  const handleQrDecoded = (decodedText: string) => {
    const now = Date.now();
    if (now - lastScanTimestampRef.current < 1500) return;
    lastScanTimestampRef.current = now;

    processDecodedPayload(decodedText, 'QR Optical Camera');
  };

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameraDevices(devices);
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const startScanner = async (cameraId?: string) => {
    setCameraError(null);
    setValidationError(null);
    try {
      if (qrScannerRef.current && isScanningRef.current) {
        await qrScannerRef.current.stop();
        qrScannerRef.current.clear();
      }

      const html5QrCode = new Html5Qrcode('qr-reader-viewport');
      qrScannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
      };

      const targetCam = cameraId || selectedCameraId || { facingMode: 'environment' };

      await html5QrCode.start(
        targetCam,
        config,
        (decodedText) => {
          handleQrDecoded(decodedText);
        },
        () => {}
      );

      isScanningRef.current = true;
      setIsCameraRunning(true);
    } catch (err: any) {
      setCameraError(
        'Camera permission unavailable or denied. Please grant camera access in your browser or use QR Image scan, RFID simulation, or User Entry.'
      );
      setIsCameraRunning(false);
      isScanningRef.current = false;
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current && isScanningRef.current) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current.clear();
      } catch (e) {}
      isScanningRef.current = false;
      setIsCameraRunning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setScanMessage('Scanning image file for CatRent QR payload...');
      const html5QrCode = new Html5Qrcode('qr-reader-file-hidden');
      const result = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      processDecodedPayload(result, 'QR Image File');
    } catch (err: any) {
      setValidationError('Could not detect a valid CatRent QR code in the uploaded image file.');
      setScanMessage(null);
    }
  };

  // ==========================================
  // 2. RFID SIMULATION METHOD HANDLERS
  // ==========================================
  const handleSimulateRfidScan = () => {
    if (!rfidSelectedEqId) return;
    setIsRfidPulsing(true);
    playScanBeep(1200);
    setTimeout(() => playScanBeep(1600), 90);

    const rfidTag = `RFID-${rfidSelectedEqId}`;
    processDecodedPayload(rfidTag, 'RFID Antenna Gate');

    setTimeout(() => setIsRfidPulsing(false), 800);
  };

  // ==========================================
  // 3. USER ENTRY METHOD HANDLERS
  // ==========================================
  const handleUserEntrySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEntryInput.trim()) {
      setValidationError('Please enter an Equipment ID or Serial Number.');
      return;
    }
    processDecodedPayload(userEntryInput.trim(), 'Manual User Entry');
  };

  const handleDirectSelect = (equipmentId: string) => {
    setUserEntryInput(equipmentId);
    setRfidSelectedEqId(equipmentId);
    processDecodedPayload(equipmentId, 'Fleet Direct Selection');
  };

  const handleResetScan = () => {
    setScannedCode(null);
    setScanMessage(null);
    setValidationError(null);
    setUserEntryInput('');
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current && isScanningRef.current) {
        qrScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const finalCustomer =
    customerName === 'Custom Customer / Individual Renter'
      ? customCustomerText || 'Direct Customer'
      : customerName;

  // Checkout Mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      setValidationError(null);
      setScanMessage(null);
      return (
        await api.post('/rentals/checkout', {
          equipmentId: eq?.equipmentId,
          operatorId: selectedOpId,
          siteId: selectedSiteId,
          expectedReturnDate,
          customerName: finalCustomer,
          contactPerson,
          poNumber,
          notes: checkoutNotes,
        })
      ).data;
    },
    onSuccess: () => {
      setScanMessage(
        `✅ Digital Check-Out Complete! Agreement activated for ${finalCustomer} • ${eq?.model} (${eq?.equipmentId}). Status updated to ACTIVE.`
      );
      queryClient.invalidateQueries({ queryKey: ['qr-scan', scannedCode] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-equipment'] });
      queryClient.invalidateQueries({ queryKey: ['rentals-list'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-all-equipment'] });
    },
    onError: (err: any) => {
      setValidationError(
        err.response?.data?.message || err.message || 'Checkout failed. Please verify form inputs.'
      );
    },
  });

  // Checkin Mutation
  const checkinMutation = useMutation({
    mutationFn: async () => {
      setValidationError(null);
      setScanMessage(null);
      return (
        await api.post('/rentals/checkin', {
          rentalId: eq?.activeRental?.rentalId,
          checkinEngineHours: checkinHours,
          checkinFuelLevel: checkinFuel,
          condition: checkinCondition,
          notes: checkinNotes,
        })
      ).data;
    },
    onSuccess: (data) => {
      setScanMessage(
        `✅ Digital Check-In Complete! Rental closed with $${formatNumber(
          data?.data?.cost || 0
        )} billed. Equipment status updated to ${checkinCondition === 'DAMAGED' ? 'MAINTENANCE' : 'AVAILABLE'}.`
      );
      queryClient.invalidateQueries({ queryKey: ['qr-scan', scannedCode] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-equipment'] });
      queryClient.invalidateQueries({ queryKey: ['rentals-list'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-all-equipment'] });
    },
    onError: (err: any) => {
      setValidationError(
        err.response?.data?.message || err.message || 'Checkin failed. Please verify input hours and status.'
      );
    },
  });

  // Site Manager authorization check
  const isSiteManagerAuthorized = () => {
    if (!user || user.role !== 'SITE_MANAGER') return true;
    if (!eq || !eq.siteId) return true;
    const assignedSites = user.assignedSiteIds || [];
    return assignedSites.includes(eq.siteId);
  };

  const isCustomerUser = user?.role === 'CUSTOMER';

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Hidden file reader container for Html5Qrcode file scans */}
      <div id="qr-reader-file-hidden" style={{ display: 'none' }} />

      {/* Main Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              Check-In / Check-Out Station
            </h1>
            <Badge variant="default" className="text-xs font-bold bg-cat-yellow text-cat-black font-mono">
              3 IDENTIFICATION METHODS
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Check-in/check-out based on QR code, RFID simulation, or user entry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {eq && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQrModalEquipment(eq)}
              className="font-bold text-xs gap-1.5 border-cat-yellow/60 text-cat-yellow hover:bg-cat-yellow hover:text-cat-black"
            >
              <QrCode className="h-4 w-4" /> Thermal QR Label
            </Button>
          )}
          <Link to="/rentals">
            <Button variant="outline" size="sm" className="font-bold text-xs gap-1.5">
              <Building2 className="h-4 w-4 text-cat-yellow" /> Active Rentals
            </Button>
          </Link>
        </div>
      </div>

      {/* Notification Banners */}
      {scanMessage && (
        <div className="p-3.5 bg-emerald-500/15 border-2 border-emerald-500/50 rounded-xl text-xs font-bold text-emerald-400 flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>{scanMessage}</span>
          </div>
          <button onClick={() => setScanMessage(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {validationError && (
        <div className="p-3.5 bg-red-500/15 border-2 border-red-500/50 rounded-xl text-xs font-bold text-red-400 flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
          <button onClick={() => setValidationError(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Exactly 3 Primary Identification Methods (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-2 border-border shadow-xl overflow-hidden">
            {/* EXACT THREE METHOD BUTTONS */}
            <div className="bg-neutral-900 border-b border-neutral-800 p-1.5 grid grid-cols-3 gap-1">
              <button
                onClick={() => handleMethodSwitch('QR_CODE')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeMethod === 'QR_CODE'
                    ? 'bg-cat-yellow text-cat-black shadow-md font-black'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <QrCode className="h-4 w-4" /> QR CODE
              </button>

              <button
                onClick={() => handleMethodSwitch('RFID_SIMULATION')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeMethod === 'RFID_SIMULATION'
                    ? 'bg-cat-yellow text-cat-black shadow-md font-black'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Radio className="h-4 w-4 text-blue-400" /> RFID SIMULATION
              </button>

              <button
                onClick={() => handleMethodSwitch('USER_ENTRY')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeMethod === 'USER_ENTRY'
                    ? 'bg-cat-yellow text-cat-black shadow-md font-black'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Search className="h-4 w-4" /> USER ENTRY
              </button>
            </div>

            <CardContent className="p-5 space-y-5">
              {/* ======================================================= */}
              {/* METHOD 1: QR CODE */}
              {/* ======================================================= */}
              {activeMethod === 'QR_CODE' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div>
                      <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
                        <QrCode className="h-4 w-4 text-cat-yellow" /> QR Code Scanner
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Point camera at machine QR (CATRENT:&lt;id&gt;) or upload QR image.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      15 FPS
                    </Badge>
                  </div>

                  {/* Real Optical Camera Viewport */}
                  <div className="relative rounded-xl overflow-hidden bg-neutral-950 border-2 border-dashed border-neutral-800 flex flex-col items-center justify-center min-h-[250px]">
                    <div id="qr-reader-viewport" className="w-full h-full" />

                    {!isCameraRunning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-neutral-950/90 backdrop-blur-sm z-10">
                        <div className="h-14 w-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-cat-yellow shadow-inner">
                          <Camera className="h-7 w-7" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">Optical Camera Ready</h4>
                          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                            Hold any machine QR code in front of the lens.
                          </p>
                        </div>
                        <Button
                          variant="cat"
                          size="sm"
                          onClick={() => startScanner()}
                          className="font-black gap-2 shadow-lg"
                        >
                          <Video className="h-4 w-4" /> Start Camera Scanner
                        </Button>
                      </div>
                    )}
                  </div>

                  {isCameraRunning && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          Camera Active (15 FPS)
                        </span>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={stopScanner}
                        className="h-7 text-xs font-bold gap-1"
                      >
                        <VideoOff className="h-3.5 w-3.5" /> Stop Camera
                      </Button>
                    </div>
                  )}

                  {cameraError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-semibold">
                      {cameraError}
                    </div>
                  )}

                  {/* Supporting internal options within QR method */}
                  <div className="pt-2 border-t border-neutral-800 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold gap-1.5 h-9"
                    >
                      <Upload className="h-3.5 w-3.5 text-blue-400" /> Upload QR Image
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSampleQRsOpen(true)}
                      className="text-xs font-bold gap-1.5 h-9 border-neutral-700"
                    >
                      <Eye className="h-3.5 w-3.5 text-cat-yellow" /> Sample QRs
                    </Button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* ======================================================= */}
              {/* METHOD 2: RFID SIMULATION */}
              {/* ======================================================= */}
              {activeMethod === 'RFID_SIMULATION' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div>
                      <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
                        <Radio className="h-4 w-4 text-blue-400" /> RFID Simulation Portal
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Simulated UHF 915.25 MHz antenna portal gate reader.
                      </p>
                    </div>
                    <Badge variant="default" className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/40 font-mono">
                      UHF 915 MHz
                    </Badge>
                  </div>

                  {/* Antenna Portal Gate Display */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    isRfidPulsing
                      ? 'border-blue-500 bg-blue-500/20 shadow-xl'
                      : 'border-neutral-800 bg-neutral-950/70'
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground uppercase font-bold flex items-center gap-1.5">
                        <Waves className="h-3.5 w-3.5 text-blue-400" /> Antenna Gate Signal:
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">-42 dBm (Strong)</span>
                    </div>

                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase">
                          Select Equipment Tag:
                        </label>
                        <select
                          value={rfidSelectedEqId}
                          onChange={(e) => setRfidSelectedEqId(e.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-cat-yellow"
                        >
                          {allFleet.map((f) => (
                            <option key={f.equipmentId} value={f.equipmentId}>
                              {f.equipmentId} — {f.model} ({f.type} • {f.status})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-semibold">Simulated Tag Payload:</span>
                        <span className="text-xs font-mono font-black text-blue-400">
                          RFID-{rfidSelectedEqId}
                        </span>
                      </div>

                      <Button
                        variant="cat"
                        size="sm"
                        onClick={handleSimulateRfidScan}
                        className="w-full font-black text-xs h-10 gap-2 shadow-lg"
                      >
                        <Radio className="h-4 w-4" /> SIMULATE RFID SCAN
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================= */}
              {/* METHOD 3: USER ENTRY */}
              {/* ======================================================= */}
              {activeMethod === 'USER_ENTRY' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div>
                      <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
                        <Search className="h-4 w-4 text-cat-yellow" /> User Entry Lookup
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Lookup equipment by Asset ID, Serial Number, or dropdown picker.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      MANUAL
                    </Badge>
                  </div>

                  <form onSubmit={handleUserEntrySearch} className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">
                        Equipment ID / Serial Number:
                      </label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="text"
                          value={userEntryInput}
                          onChange={(e) => setUserEntryInput(e.target.value)}
                          placeholder="e.g. EQX1001 or CAT-EXC-EQX1001"
                          className="bg-neutral-900 text-xs font-mono font-bold"
                        />
                        <Button type="submit" variant="cat" size="sm" className="font-bold gap-1 px-4">
                          <Search className="h-3.5 w-3.5" /> LOOKUP
                        </Button>
                      </div>
                    </div>

                    <div className="relative pt-2 border-t border-neutral-800">
                      <label className="text-xs font-bold text-muted-foreground uppercase">
                        Or Pick from Fleet List:
                      </label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleDirectSelect(e.target.value);
                        }}
                        value={scannedCode || ''}
                        className="mt-1 h-9 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-cat-yellow"
                      >
                        <option value="">-- Choose Machine --</option>
                        {allFleet.map((f) => (
                          <option key={f.equipmentId} value={f.equipmentId}>
                            {f.equipmentId}: {f.model} ({f.type} - {f.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ======================================================= */}
        {/* RIGHT COLUMN: EQUIPMENT SCAN RESULT / ACTION PANEL (7 cols) */}
        {/* ======================================================= */}
        <div className="lg:col-span-7">
          <Card className="border-2 border-border shadow-xl h-full flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cat-yellow" />
                  Equipment Scan Result & Action Panel
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete real-time telematics, rental contract state, and digital shift execution.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {eq && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetScan}
                    className="h-7 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
                  >
                    Scan Another
                  </Button>
                )}
                {eq && (
                  <Badge
                    variant={
                      eq.status === 'AVAILABLE'
                        ? 'available'
                        : eq.status === 'ACTIVE'
                        ? 'active'
                        : eq.status === 'OVERDUE'
                        ? 'overdue'
                        : eq.status === 'IDLE'
                        ? 'idle'
                        : 'secondary'
                    }
                    className="text-xs px-2.5 py-1 font-bold font-mono"
                  >
                    {eq.status}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5 flex-1">
              {/* 1. Loading State */}
              {scanLoading && (
                <div className="py-16 text-center text-muted-foreground text-xs space-y-3">
                  <RefreshCw className="h-8 w-8 mx-auto text-cat-yellow animate-spin" />
                  <div className="font-bold text-foreground">Fetching Equipment Telematics from MongoDB...</div>
                  <p className="text-[11px]">Connecting to real-time fleet registry and telemetry streams.</p>
                </div>
              )}

              {/* 2. Error / Not Found State */}
              {!scanLoading && (scanIsError || !eq) && (
                <div className="py-16 text-center text-muted-foreground text-xs space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="font-black text-sm text-foreground">
                    {scannedCode ? `Equipment "${scannedCode}" Not Found` : 'No Equipment Scanned Yet'}
                  </div>
                  <p className="text-[11px] max-w-sm mx-auto">
                    {scannedCode
                      ? `The identifier "${scannedCode}" could not be matched against any registered asset in the CatRent database.`
                      : 'Scan a machine QR code, simulate an RFID tag, or enter an Equipment ID on the left.'}
                  </p>
                  {scannedCode && (
                    <div className="pt-2 flex justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => refetchEquipment()} className="font-bold text-xs gap-1">
                        <RefreshCw className="h-3.5 w-3.5" /> Retry Lookup
                      </Button>
                      <Button variant="cat" size="sm" onClick={handleResetScan} className="font-bold text-xs">
                        Scan Different Asset
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Success State: Rich Equipment Result Panel */}
              {!scanLoading && eq && (
                <div className="space-y-5">
                  {/* Top Machine Summary Box */}
                  <div className="p-4 rounded-xl border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-2xl font-black text-cat-yellow">{eq.equipmentId}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          Serial: {eq.serialNumber}
                        </Badge>
                        <Badge
                          variant={
                            eq.status === 'AVAILABLE'
                              ? 'available'
                              : eq.status === 'ACTIVE'
                              ? 'active'
                              : eq.status === 'OVERDUE'
                              ? 'overdue'
                              : 'idle'
                          }
                          className="text-[10px] font-black uppercase font-mono"
                        >
                          {eq.status}
                        </Badge>
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-0.5">{eq.model}</h3>
                      <p className="text-xs text-muted-foreground">
                        Category: <strong className="text-foreground">{eq.type}</strong> • Base Rate:{' '}
                        <strong className="text-cat-yellow font-mono">${eq.hourlyRate}/hr</strong> • Year:{' '}
                        <strong className="text-foreground">{eq.yearManufactured || 2023}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="cat"
                        size="sm"
                        onClick={() => setQrModalEquipment(eq)}
                        className="font-bold text-xs gap-1.5 shadow-md"
                      >
                        <QrCode className="h-4 w-4" /> Thermal Label
                      </Button>
                    </div>
                  </div>

                  {/* Active Critical / High Alerts Banner */}
                  {eq.activeAlerts && eq.activeAlerts.length > 0 && (
                    <div className="p-3 bg-red-500/10 border-2 border-red-500/40 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-red-400">
                        <span className="flex items-center gap-1.5 uppercase">
                          <ShieldAlert className="h-4 w-4 animate-pulse" /> Active Risk Anomaly ({eq.activeAlerts.length})
                        </span>
                        <span className="text-[10px] font-mono">Requires Inspection</span>
                      </div>
                      {eq.activeAlerts.slice(0, 2).map((a) => (
                        <p key={a.alertId || a._id} className="text-[11px] text-foreground font-medium leading-tight">
                          • <strong className="text-red-400">{a.type}</strong>: {a.message}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Operational & Geospatial Verification Grid */}
                  <div className="p-3.5 bg-neutral-950 rounded-xl border border-border text-xs space-y-2.5">
                    <div className="font-bold text-foreground flex items-center justify-between border-b border-neutral-800 pb-2">
                      <span className="flex items-center gap-1.5 text-cat-yellow uppercase font-bold text-[11px]">
                        <ShieldCheck className="h-4 w-4" /> Telematics & Site Verification:
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Operator: <strong className="text-foreground">{eq.operator?.name || 'Unassigned'}</strong> {eq.operatorId ? `(${eq.operatorId})` : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {/* Assigned Site */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Target className="h-3.5 w-3.5 text-cat-yellow" /> Assigned Site:
                        </span>
                        <span className="font-bold text-foreground">
                          {eq.site?.name ? `${eq.site.siteId} — ${eq.site.name}` : eq.siteId || 'Depot'}
                        </span>
                      </div>

                      {/* Current Detected Site */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Crosshair className="h-3.5 w-3.5 text-emerald-400" /> Current Site:
                        </span>
                        <span className="font-bold text-foreground">
                          {eq.detectedSite ? `${eq.detectedSite.siteId} — ${eq.detectedSite.name}` : 'Outside Sites'}
                        </span>
                      </div>

                      {/* GPS Fix */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-blue-400" /> GPS Coordinates:
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {eq.lat ? `${eq.lat.toFixed(4)}, ${eq.lng.toFixed(4)}` : 'No GPS Fix'}
                        </span>
                      </div>

                      {/* Geofence Status */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Site Match:
                        </span>
                        <div>
                          {eq.siteMatchStatus === 'MATCHED' && (
                            <Badge variant="available" className="text-[9px] font-black gap-1">
                              <Check className="h-2.5 w-2.5" /> AT ASSIGNED SITE
                            </Badge>
                          )}
                          {eq.siteMatchStatus === 'WRONG_SITE' && (
                            <Badge variant="destructive" className="text-[9px] font-black gap-1 animate-pulse">
                              <AlertTriangle className="h-2.5 w-2.5" /> WRONG SITE
                            </Badge>
                          )}
                          {eq.siteMatchStatus === 'OUTSIDE_GEOFENCE' && (
                            <Badge variant="idle" className="text-[9px] font-black gap-1">
                              OUTSIDE GEOFENCE
                            </Badge>
                          )}
                          {(!eq.siteMatchStatus || eq.siteMatchStatus === 'NO_ASSIGNED_SITE') && (
                            <Badge variant="outline" className="text-[9px]">
                              UNASSIGNED
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4 Core Telematics Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div className="p-2.5 rounded-lg border border-border bg-card">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
                        <Gauge className="h-3 w-3 text-cat-yellow" /> Engine Run-Time
                      </span>
                      <div className="text-base font-black font-mono text-foreground mt-0.5">
                        {formatNumber(eq.engineHours)} hrs
                      </div>
                      <span className="text-[9px] text-muted-foreground">
                        Op: {formatNumber(eq.operatingHours || 0)}h | Idle: {formatNumber(eq.idleHours || 0)}h
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-border bg-card">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
                        <Fuel className="h-3 w-3 text-blue-400" /> Fuel Level
                      </span>
                      <div className="text-base font-black font-mono text-foreground mt-0.5">{eq.fuelLevel}%</div>
                      <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full ${eq.fuelLevel < 20 ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${eq.fuelLevel}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg border border-border bg-card">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
                        <HeartPulse className="h-3 w-3 text-emerald-400" /> Health Score
                      </span>
                      <div className="text-base font-black font-mono text-emerald-400 mt-0.5">{eq.healthScore}%</div>
                      <span className="text-[9px] text-muted-foreground">Condition: {eq.healthScore > 80 ? 'Optimal' : 'Inspection Due'}</span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-border bg-card">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
                        <Thermometer className="h-3 w-3 text-amber-400" /> Temperature
                      </span>
                      <div className="text-base font-black font-mono text-amber-400 mt-0.5">
                        {eq.temperature || 82}°C
                      </div>
                      <span className="text-[9px] text-muted-foreground">Utilization: {eq.utilization || 0}%</span>
                    </div>
                  </div>

                  {/* Active Rental Information Summary (when machine is currently rented/active) */}
                  {(eq.status === 'ACTIVE' || eq.status === 'OVERDUE') && eq.activeRental && (
                    <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-emerald-400" /> Active Rental Agreement:
                        </span>
                        <span className="font-mono font-bold text-cat-yellow">{eq.activeRental.rentalId}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">Customer / Contractor</span>
                          <div className="font-bold text-foreground truncate">{eq.activeRental.customerName || 'Contractor'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">Checkout Date</span>
                          <div className="font-mono text-foreground">{new Date(eq.activeRental.checkoutDate).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">Expected Return</span>
                          <div className="font-mono text-amber-400 font-bold">{new Date(eq.activeRental.expectedReturnDate).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">Initial Checkout Hours</span>
                          <div className="font-mono text-foreground">{formatNumber(eq.activeRental.checkoutEngineHours)} hrs</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RBAC Permission Guard Warnings */}
                  {isCustomerUser && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs flex items-center gap-2 text-blue-400">
                      <Info className="h-4 w-4 flex-shrink-0" />
                      <div>
                        <strong>Customer View Only:</strong> Shift check-in/check-out actions require Site Manager or Administrator credentials. You can request rentals from the catalog.
                      </div>
                    </div>
                  )}

                  {!isCustomerUser && !isSiteManagerAuthorized() && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <div>
                        <strong>Site Manager Notice:</strong> This machine is assigned to site{' '}
                        <strong>{eq.siteId}</strong>. Your assigned sites are: <strong>{(user?.assignedSiteIds || []).join(', ')}</strong>.
                      </div>
                    </div>
                  )}

                  {/* Action Tabs & Execution Forms */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-2">
                        {/* Tab 1: Check Out */}
                        <Button
                          variant={activeActionTab === 'checkout' ? 'cat' : 'outline'}
                          size="sm"
                          onClick={() => setActiveActionTab('checkout')}
                          disabled={eq.status === 'ACTIVE' || eq.status === 'OVERDUE' || eq.status === 'MAINTENANCE' || isCustomerUser}
                          className="font-bold text-xs gap-1.5 h-8"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> CHECK OUT
                        </Button>

                        {/* Tab 2: Check In */}
                        <Button
                          variant={activeActionTab === 'checkin' ? 'cat' : 'outline'}
                          size="sm"
                          onClick={() => setActiveActionTab('checkin')}
                          disabled={eq.status === 'AVAILABLE' || !eq.activeRental || isCustomerUser}
                          className="font-bold text-xs gap-1.5 h-8"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> CHECK IN
                        </Button>

                        {/* Tab 3: Details */}
                        <Button
                          variant={activeActionTab === 'details' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setActiveActionTab('details')}
                          className="font-bold text-xs gap-1.5 h-8"
                        >
                          <Info className="h-3.5 w-3.5" /> SUMMARY
                        </Button>
                      </div>

                      <Link to={`/equipment/${eq.equipmentId}`}>
                        <Button variant="outline" size="sm" className="font-bold text-xs gap-1 h-8 text-cat-yellow border-cat-yellow/40 hover:bg-cat-yellow hover:text-cat-black">
                          <ExternalLink className="h-3.5 w-3.5" /> Full Asset Dossier →
                        </Button>
                      </Link>
                    </div>

                    {/* SECTION A: CHECK-OUT FORM */}
                    {activeActionTab === 'checkout' && !isCustomerUser && (
                      <div className="p-4 rounded-xl border-2 border-cat-yellow/40 bg-card space-y-4 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-cat-yellow" />
                            Digital Equipment Check-Out (Shift Deployment)
                          </h4>
                          <Badge variant="available" className="text-[10px] font-mono font-bold">
                            DEPLOYMENT READY
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* Customer Organization */}
                          <div>
                            <label className="font-bold text-foreground">Customer / Contractor Organization *</label>
                            <select
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-cat-yellow"
                            >
                              {ENTERPRISE_CUSTOMERS.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Contact Person */}
                          <div>
                            <label className="font-bold text-foreground">Site Superintendent / Contact *</label>
                            <Input
                              type="text"
                              value={contactPerson}
                              onChange={(e) => setContactPerson(e.target.value)}
                              placeholder="David Miller (Site Superintendent)"
                              className="mt-1 text-xs"
                            />
                          </div>

                          {/* Destination Site */}
                          <div>
                            <label className="font-bold text-foreground">Destination Project Site *</label>
                            <select
                              value={selectedSiteId}
                              onChange={(e) => setSelectedSiteId(e.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-cat-yellow"
                            >
                              {sites.map((s) => (
                                <option key={s.siteId} value={s.siteId}>
                                  {s.siteId}: {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Operator */}
                          <div>
                            <label className="font-bold text-foreground">Assigned Certified Operator *</label>
                            <select
                              value={selectedOpId}
                              onChange={(e) => setSelectedOpId(e.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-cat-yellow"
                            >
                              {operators.map((op) => (
                                <option key={op.operatorId} value={op.operatorId}>
                                  {op.operatorId}: {op.name} ({op.qualification?.join(', ') || 'Heavy Class'})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Expected Return Date */}
                          <div>
                            <label className="font-bold text-foreground">Expected Return Date *</label>
                            <Input
                              type="date"
                              value={expectedReturnDate}
                              onChange={(e) => setExpectedReturnDate(e.target.value)}
                              className="mt-1 text-xs font-mono font-bold"
                            />
                          </div>

                          {/* PO Number */}
                          <div>
                            <label className="font-bold text-foreground">Purchase Order # / Reference</label>
                            <Input
                              type="text"
                              value={poNumber}
                              onChange={(e) => setPoNumber(e.target.value)}
                              placeholder="PO-2026-CAT-7740"
                              className="mt-1 text-xs font-mono"
                            />
                          </div>
                        </div>

                        <Button
                          variant="cat"
                          size="sm"
                          onClick={() => checkoutMutation.mutate()}
                          disabled={checkoutMutation.isPending || !isSiteManagerAuthorized()}
                          className="w-full font-black text-xs h-10 gap-2 shadow-lg"
                        >
                          {checkoutMutation.isPending ? (
                            'Executing Digital Check-Out...'
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" /> CONFIRM DIGITAL CHECK-OUT
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* SECTION B: CHECK-IN FORM */}
                    {activeActionTab === 'checkin' && !isCustomerUser && (
                      <div className="p-4 rounded-xl border-2 border-emerald-500/40 bg-card space-y-4 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <RotateCcw className="h-4 w-4 text-emerald-400" />
                            Digital Equipment Check-In (Shift Return)
                          </h4>
                          <Badge variant="active" className="text-[10px] font-mono font-bold">
                            RENTAL: {eq.activeRental?.rentalId}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          {/* Return Engine Hours */}
                          <div>
                            <label className="font-bold text-foreground">Final Return Engine Hours *</label>
                            <Input
                              type="number"
                              value={checkinHours}
                              onChange={(e) => setCheckinHours(Number(e.target.value))}
                              className="mt-1 font-mono font-bold text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground">
                              Run-Time: +{Math.max(0, checkinHours - (eq.activeRental?.checkoutEngineHours || eq.engineHours))} hrs
                            </span>
                          </div>

                          {/* Return Fuel Level */}
                          <div>
                            <label className="font-bold text-foreground">Final Return Fuel Level (%) *</label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={checkinFuel}
                              onChange={(e) => setCheckinFuel(Number(e.target.value))}
                              className="mt-1 font-mono font-bold text-xs"
                            />
                          </div>

                          {/* Machine Return Condition */}
                          <div>
                            <label className="font-bold text-foreground">Return Physical Condition *</label>
                            <select
                              value={checkinCondition}
                              onChange={(e) => setCheckinCondition(e.target.value as any)}
                              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-cat-yellow"
                            >
                              <option value="GOOD">Good (Set status to AVAILABLE)</option>
                              <option value="DAMAGED">Damaged / Issue (Set to MAINTENANCE)</option>
                            </select>
                          </div>
                        </div>

                        {/* Checkin Notes */}
                        <div>
                          <label className="font-bold text-foreground text-xs">Inspection & Return Notes</label>
                          <Input
                            type="text"
                            value={checkinNotes}
                            onChange={(e) => setCheckinNotes(e.target.value)}
                            className="mt-1 text-xs"
                          />
                        </div>

                        <Button
                          variant="cat"
                          size="sm"
                          onClick={() => checkinMutation.mutate()}
                          disabled={checkinMutation.isPending || !isSiteManagerAuthorized()}
                          className="w-full font-black text-xs h-10 gap-2 shadow-lg"
                        >
                          {checkinMutation.isPending ? (
                            'Completing Digital Check-In...'
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4" /> COMPLETE DIGITAL CHECK-IN
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* SECTION C: SUMMARY VIEW */}
                    {activeActionTab === 'details' && (
                      <div className="p-3 bg-neutral-900/50 rounded-xl border border-neutral-800 text-xs space-y-2 text-muted-foreground">
                        <p>
                          • To deploy this asset for an active shift, switch to the <strong>CHECK OUT</strong> tab.
                        </p>
                        <p>
                          • To close an active agreement and log shift run-time hours, switch to the <strong>CHECK IN</strong> tab.
                        </p>
                        <p>
                          • For complete usage histories, IoT sensor charts, and scheduled maintenance records, click <strong>Full Asset Dossier</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SAMPLE QR CODES HELPER MODAL */}
      <Dialog open={sampleQRsOpen} onOpenChange={setSampleQRsOpen}>
        <DialogClose onClose={() => setSampleQRsOpen(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-black">
            <QrCode className="h-5 w-5 text-cat-yellow" /> Sample Fleet QR Code Matrix
          </DialogTitle>
          <DialogDescription>
            High-contrast optical QR codes ready for camera scanning or image download.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1">
          {allFleet.slice(0, 12).map((asset) => (
            <div
              key={asset.equipmentId}
              onClick={() => {
                setQrModalEquipment(asset);
                setSampleQRsOpen(false);
              }}
              className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 hover:border-cat-yellow transition-all cursor-pointer text-center space-y-2"
            >
              {sampleQrUrls[asset.equipmentId] ? (
                <img
                  src={sampleQrUrls[asset.equipmentId]}
                  alt={asset.equipmentId}
                  className="w-24 h-24 mx-auto bg-white p-1 rounded-lg"
                />
              ) : (
                <div className="w-24 h-24 mx-auto bg-neutral-800 rounded-lg animate-pulse" />
              )}
              <div>
                <div className="font-mono text-xs font-black text-cat-yellow">{asset.equipmentId}</div>
                <div className="text-[11px] font-bold text-foreground truncate">{asset.model}</div>
                <div className="text-[9px] text-muted-foreground font-mono">CATRENT:{asset.equipmentId}</div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setSampleQRsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Reusable QR Code View & Download Modal */}
      <QRCodeModal
        equipment={qrModalEquipment}
        open={!!qrModalEquipment}
        onClose={() => setQrModalEquipment(null)}
      />
    </div>
  );
}
