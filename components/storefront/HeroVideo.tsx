"use client";

import { useEffect, useRef, useState } from "react";

const VIDEO_SOURCE = "/video/gemini_generated_video_2b51582c.mp4";
const VIDEO_POSTER = "/img/hero-video-poster.jpg";

export function HeroVideo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setMotionEnabled(!motionPreference.matches);

    updatePreference();
    motionPreference.addEventListener("change", updatePreference);
    return () => motionPreference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    const section = stage?.closest<HTMLElement>(".banner");
    const scene = stage?.closest<HTMLElement>(".hero-scroll-scene");
    if (!motionEnabled || videoFailed || !video || !section || !scene) return;

    let frame = 0;
    let targetTime = 0;

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(advance);
    };

    const advance = () => {
      frame = 0;
      if (!Number.isFinite(video.duration) || video.duration <= 0 || video.seeking) return;

      if (Math.abs(targetTime - video.currentTime) < 0.025) return;
      video.currentTime = targetTime;
    };

    const updateTarget = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      const bounds = section.getBoundingClientRect();
      const sectionTop = bounds.top + window.scrollY;
      const headerHeight = document.querySelector(".header")?.getBoundingClientRect().height ?? 0;
      const start = Math.max(0, sectionTop - headerHeight);
      const distance = Math.max(1, section.offsetHeight - scene.offsetHeight);
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
        <div className="hero-video-fallback" aria-hidden="true" />
        {motionEnabled && !videoFailed && (
          <video
            ref={videoRef}
            className={`hero-video ${videoReady ? "is-ready" : ""}`}
            muted
            playsInline
            preload="auto"
            poster={VIDEO_POSTER}
            aria-hidden="true"
            tabIndex={-1}
            onLoadStart={() => setVideoReady(false)}
            onLoadedData={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
          >
            <source src={VIDEO_SOURCE} type="video/mp4" />
          </video>
        )}
      </div>
      <span className="hero-video-corner hero-video-corner-top" aria-hidden="true" />
      <span className="hero-video-corner hero-video-corner-bottom" aria-hidden="true" />
      <span className="hero-video-label">
        {motionEnabled && !videoFailed ? "ROLE PARA VER" : "MAKNA'S"} <b>•</b> FEITO NA BRASA
      </span>
    </div>
  );
}
