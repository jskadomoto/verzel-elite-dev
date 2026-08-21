"use client";

import { useEffect, useRef, useState } from "react";

const FRAME_INTERVAL_MS = 100;
const MAX_FRAME_SIDE = 480;
const WORKER_TIMEOUT_MS = 2000;
const FAILURE_LIMIT = 5;

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded border px-4 text-base";

const DECODER_LOST =
  "A leitura por câmera parou de responder neste aparelho. Use o campo de código abaixo.";

export function GateScanner({
  paused,
  onCode,
}: Readonly<{ paused: boolean; onCode: (code: string) => void }>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!live) return;

    const worker = new Worker("/qr-decoder.worker.js");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    let timer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let awaiting = 0;
    let failures = 0;
    let stopped = false;

    const schedule = () => {
      if (!stopped) timer = setTimeout(pump, FRAME_INTERVAL_MS);
    };

    function settle(ticket: number, failed: boolean) {
      if (stopped || ticket !== awaiting) return;
      awaiting = 0;
      clearTimeout(watchdog);

      failures = failed ? failures + 1 : 0;
      if (failures >= FAILURE_LIMIT) {
        stopped = true;
        setProblem(DECODER_LOST);
        return;
      }
      schedule();
    }

    function pump() {
      const video = videoRef.current;
      if (stopped) return;

      if (
        !video ||
        !context ||
        pausedRef.current ||
        video.readyState < video.HAVE_CURRENT_DATA ||
        !video.videoWidth
      ) {
        schedule();
        return;
      }

      const ticket = Date.now() + Math.random();
      awaiting = ticket;
      watchdog = setTimeout(() => settle(ticket, true), WORKER_TIMEOUT_MS);

      try {
        const scale = Math.min(
          1,
          MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight),
        );
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        worker.postMessage(
          { data: frame.data, width: canvas.width, height: canvas.height },
          [frame.data.buffer],
        );
      } catch {
        settle(ticket, true);
      }
    }

    worker.onmessage = ({ data }: MessageEvent<string | null>) => {
      const ticket = awaiting;
      if (data && !pausedRef.current && !stopped) onCodeRef.current(data);
      settle(ticket, false);
    };

    worker.onerror = (event) => {
      event.preventDefault();
      settle(awaiting, true);
    };

    schedule();

    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(watchdog);
      worker.terminate();
    };
  }, [live]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function start() {
    setProblem(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem(
        "Este navegador não libera a câmera aqui, o que acontece fora de HTTPS. Use o campo de código abaixo.",
      );
      return;
    }

    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
    } catch {
      setProblem(
        "Não foi possível abrir a câmera. Verifique a permissão do navegador e use o campo de código abaixo enquanto isso.",
      );
    } finally {
      setStarting(false);
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="overflow-hidden rounded border">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`aspect-square w-full bg-neutral-900 object-cover ${
            live ? "" : "hidden"
          }`}
        />

        {live ? null : (
          <p className="flex aspect-square w-full items-center justify-center bg-neutral-900 p-4 text-center text-sm text-neutral-400">
            A câmera está desligada. A leitura por digitação funciona sem ela.
          </p>
        )}
      </div>

      {problem ? (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      ) : null}

      <button
        type="button"
        onClick={live ? stop : start}
        disabled={starting}
        className={`${buttonClass} disabled:opacity-60`}
      >
        {live ? "Desligar câmera" : starting ? "Abrindo…" : "Ligar câmera"}
      </button>
    </section>
  );
}
