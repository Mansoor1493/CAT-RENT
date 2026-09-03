import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Equipment } from '@/types';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  Truck,
  MapPin,
  ShieldCheck,
  Sparkles,
  FileCode,
} from 'lucide-react';

interface QRCodeModalProps {
  equipment: Equipment | null;
  open: boolean;
  onClose: () => void;
}

export default function QRCodeModal({ equipment, open, onClose }: QRCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const payload = equipment ? `CATRENT:${equipment.equipmentId}` : '';

  // Generate high-resolution QR code whenever equipment changes
  useEffect(() => {
    if (equipment && payload) {
      QRCode.toDataURL(payload, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => {
          setQrDataUrl(url);
        })
        .catch((err) => {
          console.error('QR generation error:', err);
        });
    }
  }, [equipment?.equipmentId, payload]);

  if (!equipment) return null;

  // 1. Download PNG with full branded card layout
  const handleDownloadPNG = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 720);

      // Top CatRent Yellow Header Banner
      ctx.fillStyle = '#FFCD11';
      ctx.fillRect(0, 0, 600, 90);

      // Header Text
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CatRent Industrial Telematics', 300, 48);

      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.fillStyle = '#333333';
      ctx.fillText('SMART ASSET TRACKING & RENTAL SYSTEM', 300, 74);

      // Machine Title & Model
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText(`${equipment.equipmentId} • ${equipment.model}`, 300, 135);

      ctx.fillStyle = '#555555';
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText(
        `${equipment.type}  |  Site: ${equipment.siteId || 'Unassigned'}  |  Serial: ${equipment.serialNumber}`,
        300,
        165
      );

      // Draw QR Code in center
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.src = qrDataUrl;
      await new Promise((resolve) => {
        qrImg.onload = resolve;
      });

      // QR Code Border Box
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 3;
      ctx.strokeRect(120, 195, 360, 360);
      ctx.drawImage(qrImg, 130, 205, 340, 340);

      // Payload Text Box
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(80, 580, 440, 45);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.strokeRect(80, 580, 440, 45);

      ctx.fillStyle = '#111111';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(payload, 300, 610);

      // Footer
      ctx.fillStyle = '#888888';
      ctx.font = '12px Arial, sans-serif';
      ctx.fillText('Authorized Caterpillar Telematics Matrix  •  Scannable via CatRent Optical Station', 300, 665);
      ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, 300, 685);

      // Trigger Download
      const link = document.createElement('a');
      link.download = `CatRent-${equipment.equipmentId}-QR.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Failed to download PNG:', e);
    }
  };

  // 2. Download Vector SVG
  const handleDownloadSVG = async () => {
    try {
      const svgString = await QRCode.toString(payload, {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `CatRent-${equipment.equipmentId}-QR.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download SVG:', e);
    }
  };

  // 3. Print Label Functionality
  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank', 'width=650,height=750');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CatRent Label - ${equipment.equipmentId}</title>
          <style>
            @page {
              size: 4in 6in;
              margin: 0.2in;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              text-align: center;
              color: #000000;
              background: #ffffff;
            }
            .header-banner {
              background: #FFCD11;
              color: #000;
              padding: 12px;
              font-size: 20px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 1px;
              border-radius: 6px;
              margin-bottom: 15px;
            }
            .machine-id {
              font-size: 28px;
              font-weight: 900;
              margin: 5px 0;
              font-family: monospace;
            }
            .model-name {
              font-size: 18px;
              font-weight: bold;
              color: #333;
              margin-bottom: 8px;
            }
            .meta {
              font-size: 12px;
              color: #555;
              margin-bottom: 15px;
            }
            .qr-container {
              margin: 15px auto;
              padding: 10px;
              border: 2px solid #000;
              display: inline-block;
              border-radius: 8px;
            }
            .qr-container img {
              width: 260px;
              height: 260px;
              display: block;
            }
            .payload-box {
              background: #f0f0f0;
              border: 1px solid #ccc;
              padding: 8px;
              font-family: monospace;
              font-size: 16px;
              font-weight: bold;
              margin: 12px auto;
              display: inline-block;
              border-radius: 4px;
            }
            .footer {
              font-size: 10px;
              color: #777;
              margin-top: 15px;
              border-top: 1px dashed #ccc;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="header-banner">CatRent Industrial Asset</div>
          <div class="machine-id">${equipment.equipmentId}</div>
          <div class="model-name">${equipment.model}</div>
          <div class="meta">${equipment.type} &bull; Site: ${equipment.siteId || 'Unassigned'} &bull; Serial: ${equipment.serialNumber}</div>
          
          <div class="qr-container">
            <img src="${qrDataUrl}" alt="${payload}" />
          </div>
          
          <div>
            <div class="payload-box">${payload}</div>
          </div>
          
          <div class="footer">
            Caterpillar Telematics Matrix &bull; Scan with CatRent Optical Reader
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogClose onClose={onClose} />
      <DialogHeader>
        <div className="flex items-center gap-2 text-xs font-bold text-cat-yellow uppercase font-mono">
          <Sparkles className="h-3.5 w-3.5" /> Machine-Readable QR Matrix
        </div>
        <DialogTitle className="text-xl font-black text-foreground flex items-center justify-between">
          <span>Equipment QR Label — {equipment.equipmentId}</span>
          <Badge variant="available" className="font-mono text-[10px]">
            {equipment.status}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          High-contrast optical QR code formatted for mobile camera readers and industrial scanners.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Large High-Contrast Scannable QR Code Card */}
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border-4 border-cat-yellow/60 shadow-2xl">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR for ${equipment.equipmentId}`}
              className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center text-neutral-400 font-mono text-xs">
              Generating High-Res QR...
            </div>
          )}

          {/* Payload Display inside card */}
          <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 border border-neutral-300">
            <span className="text-xs font-mono font-black text-neutral-900">{payload}</span>
            <button
              onClick={copyPayload}
              className="p-1 rounded text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
              title="Copy Payload"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Equipment Metadata Breakdown */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-3 rounded-xl border border-border">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Equipment Model</span>
            <div className="font-bold text-foreground truncate">{equipment.model}</div>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Class / Type</span>
            <div className="font-bold text-foreground">{equipment.type}</div>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Current Location</span>
            <div className="font-bold text-foreground">{equipment.siteId || 'Main Depot'}</div>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Hourly Rate</span>
            <div className="font-mono font-bold text-cat-yellow">${equipment.hourlyRate}/hr</div>
          </div>
        </div>
      </div>

      {/* Action Buttons: Download PNG, Download SVG, Print Label, Close */}
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadSVG}
          className="text-xs font-bold gap-1.5 w-full sm:w-auto"
        >
          <FileCode className="h-4 w-4 text-blue-400" /> Download SVG
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrintLabel}
          className="text-xs font-bold gap-1.5 w-full sm:w-auto"
        >
          <Printer className="h-4 w-4 text-emerald-400" /> Print Label
        </Button>
        <Button
          variant="cat"
          size="sm"
          onClick={handleDownloadPNG}
          className="text-xs font-black gap-1.5 shadow-lg w-full sm:w-auto"
        >
          <Download className="h-4 w-4" /> Download PNG
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
