"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const VIDEO_SOURCE = "/video/gemini_generated_video_2b51582c.mp4";

export function HeroVideo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const updatePreference = () => setMotionEnabled(!motionPreference.matches && !connection?.saveData);

    updatePreference();
    motionPreference.addEventListener("change", updatePreference);
    return () => motionPreference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!motionEnabled || videoFailed || !stage || !video) return;

    let frame = 0;
    let targetTime = 0;

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(advance);
    };

    const advance = () => {
      frame = 0;
      if (!Number.isFinite(video.duration) || video.duration <= 0 || video.seeking) return;

      const difference = targetTime - video.currentTime;
      if (Math.abs(difference) < 0.025) return;

      video.currentTime = Math.min(
        Math.max(video.currentTime + difference * 0.28, 0),
        Math.max(0, video.duration - 0.05),
      );
      if (!video.seeking) schedule();
    };

    const updateTarget = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      const bounds = stage.getBoundingClientRect();
      const stageTop = bounds.top + window.scrollY;
      const headerHeight = document.querySelector(".header")?.getBoundingClientRect().height ?? 0;
      const start = Math.max(0, stageTop - headerHeight);
      const distance = Math.max(bounds.height, window.innerHeight * 0.45);
      const progress = Math.min(1, Math.max(0, (window.scrollY - start) / distance));

      targetTime = progress * Math.max(0, video.duration - 0.05);
      schedule();
    };

    video.pause();
    video.addEventListener("loadedmetadata", updateTarget);
    video.addEventListener("seeked", schedule);
    window.addEventListener("scroll", updateTarget, { passive: true });
    window.addEventListener("resize", updateTarget);
    updateTarget();

    return () => {
      window.cancelAnimationFrame(frame);
      video.removeEventListener("loadedmetadata", updateTarget);
      video.removeEventListener("seeked", schedule);
      window.removeEventListener("scroll", updateTarget);
      window.removeEventListener("resize", updateTarget);
    };
  }, [motionEnabled, videoFailed]);

  return (
    <div className="hero-video-stage" ref={stageRef} role="img" aria-label="Vídeo da Makna's Burguer controlado pela rolagem da página">
      <div className="hero-video-screen">
        <div className="hero-video-fallback">
          <Image src="/img/logo-maknas.png" width={550} height={550} priority alt="" />
        </div>
        {motionEnabled && !videoFailed && (
          <video
            ref={videoRef}
            className={`hero-video ${videoReady ? "is-ready" : ""}`}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            onLoadedData={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
          >
            <source src={VIDEO_SOURCE} type="video/mp4" />
          </video>
        )}
      </div>
      <span className="hero-video-corner hero-video-corner-top" aria-hidden="true" />
      <span className="hero-video-corner hero-video-corner-bottom" aria-hidden="true" />
      <span className="hero-video-label">MAKNA&apos;S <b>•</b> FEITO NA BRASA</span>
    </div>
  );
}
