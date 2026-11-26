import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Camera, CameraOff, Upload, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'
import Button from '../common/Button'
import { useLanguage } from '../../i18n'

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
]

/**
 * Reusable live camera + image-file QR & Code 128 barcode scanner.
 * Explicitly stops all MediaStream tracks so the webcam/phone camera LED turns off immediately.
 */
export default function QrCameraScanner({
  onScanSuccess,
  onError,
  autoStart = false,
  compact = false,
  label,
}) {
  const { t } = useLanguage()
  const rawId = useId()
  const readerElementId = `qr-reader-${rawId.replace(/:/g, '')}`
  const scannerRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastDecodedRef = useRef({ code: '', time: 0 })
  const unmountedRef = useRef(false)
  const startAttemptRef = useRef(0)

  const [isScanning, setIsScanning] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [cameraError, setCameraError] = useState('')

  const releaseAllVideoTracks = () => {
    const container = document.getElementById(readerElementId)
    if (!container) return
    const videos = container.querySelectorAll('video')
    videos.forEach((video) => {
      const stream = video.srcObject
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch {
            // Ignore already-stopped tracks
          }
        })
      }
      video.srcObject = null
    })
  }

  const stopScanner = async () => {
    startAttemptRef.current += 1
    const instance = scannerRef.current
    scannerRef.current = null

    // Immediately release hardware camera tracks so the webcam LED turns off right away
    releaseAllVideoTracks()

    if (instance) {
      try {
        if (instance.isScanning) {
          await instance.stop()
        }
      } catch {
        // Ignore stop errors if stream was already halted
      }
      try {
        await instance.clear()
      } catch {
        // Ignore DOM cleanup errors
      }
    }

    releaseAllVideoTracks()
    const container = document.getElementById(readerElementId)
    if (container) {
      container.innerHTML = ''
    }

    if (!unmountedRef.current) {
      setIsStarting(false)
      setIsScanning(false)
    }
  }

  const refreshCameraListPassive = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({
          id: d.deviceId,
          label: d.label || t('verification.camera.cameraLabelN', { n: idx + 1 }),
        }))
      if (!unmountedRef.current) {
        setCameras(videoInputs)
      }
    } catch {
      // Camera switcher list is optional
    }
  }

  const handleDecoded = (decodedText) => {
    const clean = (decodedText || '').trim()
    if (!clean) return

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
    await stopScanner()
    if (unmountedRef.current) return

    const attemptId = startAttemptRef.current + 1
    startAttemptRef.current = attemptId
    setIsStarting(true)

    try {
      const html5Qr = new Html5Qrcode(readerElementId, {
        verbose: false,
        formatsToSupport: SUPPORTED_FORMATS,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      })
      scannerRef.current = html5Qr

      const chosenId = cameraIdOverride || selectedCameraId
      const cameraConfig = chosenId ? { deviceId: { exact: chosenId } } : { facingMode: 'environment' }

      try {
        await html5Qr.start(
          cameraConfig,
          {
            fps: 12,
            qrbox: compact ? { width: 200, height: 200 } : { width: 240, height: 240 },
          },
          (decodedText) => handleDecoded(decodedText),
          () => {}
        )
      } catch (primaryErr) {
        if (!chosenId) {
          await html5Qr.start(
            { facingMode: 'user' },
            {
              fps: 12,
              qrbox: compact ? { width: 200, height: 200 } : { width: 240, height: 240 },
            },
            (decodedText) => handleDecoded(decodedText),
            () => {}
          )
        } else {
          throw primaryErr
        }
      }

      // If user clicked Stop Camera or unmounted while camera was initializing, shut it down immediately
      if (unmountedRef.current || startAttemptRef.current !== attemptId) {
        await stopScanner()
        return
      }

      setIsScanning(true)
      refreshCameraListPassive()
    } catch (err) {
      const msg = err?.message || t('verification.camera.accessErr')
      releaseAllVideoTracks()
      if (!unmountedRef.current) {
        setCameraError(msg)
        setIsScanning(false)
        if (onError) onError(msg)
      }
    } finally {
      if (!unmountedRef.current) {
        setIsStarting(false)
      }
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setCameraError('')
    try {
      await stopScanner()
      const fileScanner = new Html5Qrcode(readerElementId, {
        verbose: false,
        formatsToSupport: SUPPORTED_FORMATS,
      })
      const decodedText = await fileScanner.scanFile(file, false)
      await fileScanner.clear()
      handleDecoded(decodedText)
    } catch (err) {
      const msg = t('verification.camera.imageDecodeErr')
      setCameraError(msg)
      if (onError) onError(err?.message || msg)
    }
  }

  useEffect(() => {
    unmountedRef.current = false
    if (autoStart) {
      startScanner()
    }
    return () => {
      unmountedRef.current = true
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-xl border border-slate-200 dark:border-emerald-500/20 bg-slate-50/70 dark:bg-[#081210] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
          <Camera size={15} className="text-emerald-600 dark:text-emerald-400" />
          <span>{label || t('verification.camera.title')}</span>
          {isScanning && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
              {t('verification.camera.cameraActive')}
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
              <option value="">{t('verification.camera.defaultCamera')}</option>
              {cameras.map((cam, idx) => (
                <option key={cam.id || idx} value={cam.id}>
                  {cam.label || t('verification.camera.cameraLabelN', { n: idx + 1 })}
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
            {t('verification.camera.scanImageBtn')}
          </Button>

          {!isScanning && !isStarting ? (
            <Button
              type="button"
              variant="primary"
              size="xs"
              leftIcon={<Camera size={12} />}
              onClick={() => startScanner()}
            >
              {t('verification.camera.startCamera')}
            </Button>
          ) : (
            <>
              {isScanning && (
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  leftIcon={<RefreshCw size={12} />}
                  onClick={() => startScanner()}
                >
                  {t('verification.camera.restartBtn')}
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                size="xs"
                leftIcon={<CameraOff size={12} />}
                onClick={stopScanner}
              >
                {t('verification.camera.stopCamera')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Live Video Mount Point + Immediate Loading Feedback */}
      <div
        className={`relative w-full overflow-hidden rounded-xl bg-slate-900/90 text-white ${
          isStarting || isScanning ? (compact ? 'min-h-[220px]' : 'min-h-[260px]') : 'hidden'
        }`}
      >
        {isStarting && !isScanning && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-xs text-slate-200 bg-slate-900/95">
            <Loader2 size={22} className="animate-spin text-emerald-400" />
            <span>{t('verification.camera.startingHint')}</span>
          </div>
        )}
        <div id={readerElementId} className="w-full h-full" />
      </div>

      {!isScanning && !isStarting && !cameraError && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {t('verification.camera.idleHint')}
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
