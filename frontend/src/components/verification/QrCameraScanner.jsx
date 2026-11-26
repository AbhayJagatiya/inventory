import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff, Upload, RefreshCw, AlertCircle } from 'lucide-react'
import Button from '../common/Button'

/**
 * Reusable live camera + image-file QR & Code 128 barcode scanner.
 * Works on desktop webcams and mobile rear/front cameras via html5-qrcode.
 */
export default function QrCameraScanner({
  onScanSuccess,
  onError,
  autoStart = false,
  compact = false,
  label = 'Camera QR / Barcode Scanner',
}) {
  const rawId = useId()
  const readerElementId = `qr-reader-${rawId.replace(/:/g, '')}`
  const scannerRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastDecodedRef = useRef({ code: '', time: 0 })

  const [isScanning, setIsScanning] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [cameraError, setCameraError] = useState('')

  const stopScanner = async () => {
    const instance = scannerRef.current
    if (!instance) {
      setIsScanning(false)
      return
    }
    try {
      if (instance.isScanning) {
        await instance.stop()
      }
      await instance.clear()
    } catch {
      // Ignore cleanup errors when camera stream was already closed
    } finally {
      scannerRef.current = null
      setIsScanning(false)
    }
  }

  const handleDecoded = (decodedText) => {
    const clean = (decodedText || '').trim()
    if (!clean) return

    // Throttle identical repeated frames within 1.5 seconds
    const now = Date.now()
    if (lastDecodedRef.current.code === clean && now - lastDecodedRef.current.time < 1500) {
      return
    }
    lastDecodedRef.current = { code: clean, time: now }

    if (onScanSuccess) {
      onScanSuccess(clean)
    }
  }

  const startScanner = async (cameraIdOverride) => {
    setCameraError('')
    setIsStarting(true)

    try {
      await stopScanner()

      const availableCameras = await Html5Qrcode.getCameras()
      setCameras(availableCameras || [])

      let targetConfig = { facingMode: 'environment' }
      const chosenId = cameraIdOverride || selectedCameraId
      if (chosenId) {
        targetConfig = chosenId
      } else if (availableCameras && availableCameras.length > 0) {
        // Prefer rear camera on mobile phones when labeled
        const backCam = availableCameras.find((c) => /back|rear|environment/i.test(c.label))
        const preferred = backCam || availableCameras[0]
        setSelectedCameraId(preferred.id)
        targetConfig = preferred.id
      }

      const html5Qr = new Html5Qrcode(readerElementId, { verbose: false })
      scannerRef.current = html5Qr

      await html5Qr.start(
        targetConfig,
        {
          fps: 10,
          qrbox: compact ? { width: 200, height: 200 } : { width: 240, height: 240 },
          aspectRatio: 1.333,
        },
        (decodedText) => handleDecoded(decodedText),
        () => {
          // Per-frame decode miss is expected while aiming camera
        }
      )

      setIsScanning(true)
    } catch (err) {
      const msg =
        err?.message ||
        'Unable to access camera. Allow browser camera permission or use Manual Entry / Image Upload.'
      setCameraError(msg)
      setIsScanning(false)
      if (onError) onError(msg)
    } finally {
      setIsStarting(false)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setCameraError('')
    try {
      await stopScanner()
      const fileScanner = new Html5Qrcode(readerElementId, { verbose: false })
      const decodedText = await fileScanner.scanFile(file, false)
      await fileScanner.clear()
      handleDecoded(decodedText)
    } catch (err) {
      const msg =
        'Could not detect a valid QR code or barcode in the uploaded image. Try a clearer image or manual entry.'
      setCameraError(msg)
      if (onError) onError(err?.message || msg)
    }
  }

  useEffect(() => {
    if (autoStart) {
      startScanner()
    }
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-xl border border-slate-200 dark:border-emerald-500/20 bg-slate-50/70 dark:bg-[#081210] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
          <Camera size={15} className="text-emerald-600 dark:text-emerald-400" />
          <span>{label}</span>
          {isScanning && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
              Camera Active
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cameras.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={(e) => {
                const nextId = e.target.value
                setSelectedCameraId(nextId)
                if (isScanning) startScanner(nextId)
              }}
              className="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 text-slate-800 dark:text-slate-100"
            >
              {cameras.map((cam, idx) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          <Button
            type="button"
            variant="secondary"
            size="xs"
            leftIcon={<Upload size={12} />}
            onClick={() => fileInputRef.current?.click()}
          >
            Scan QR Image
          </Button>

          {!isScanning ? (
            <Button
              type="button"
              variant="primary"
              size="xs"
              loading={isStarting}
              leftIcon={<Camera size={12} />}
              onClick={() => startScanner()}
            >
              Start Camera
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                leftIcon={<RefreshCw size={12} />}
                onClick={() => startScanner()}
              >
                Restart
              </Button>
              <Button
                type="button"
                variant="danger"
                size="xs"
                leftIcon={<CameraOff size={12} />}
                onClick={stopScanner}
              >
                Stop Camera
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Live Video Mount Point */}
      <div
        id={readerElementId}
        className={`w-full overflow-hidden rounded-xl bg-slate-900/90 text-white ${
          isScanning ? (compact ? 'min-h-[220px]' : 'min-h-[280px]') : 'hidden'
        }`}
      />

      {!isScanning && !cameraError && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Click <strong>Start Camera</strong> to scan QR codes or barcodes using your desktop webcam or mobile camera,
          or upload a QR image with <strong>Scan QR Image</strong>.
        </p>
      )}

      {cameraError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{cameraError}</span>
        </div>
      )}
    </div>
  )
}
