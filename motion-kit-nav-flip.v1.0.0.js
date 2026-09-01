(function (global) {
  "use strict";

  const STYLE_ID = "motion-kit-nav-flip-v1-styles";
  const initialized = new WeakMap();

  function addStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-mk-flip-link] {
        perspective: var(--mk-flip-perspective, 500px);
      }

      [data-mk-flip-clip] {
        position: relative;
        display: block;
        height: var(--mk-flip-height, 1.15em);
        overflow: hidden;
        line-height: var(--mk-flip-line-height, 1.15);
      }

      [data-mk-flip-current],
      [data-mk-flip-next] {
        display: block;
        white-space: nowrap;
        will-change: transform;
      }

      [data-mk-flip-current] {
        transform-origin: 50% 0%;
      }

      [data-mk-flip-next] {
        position: absolute;
        top: 100%;
        left: 0;
        transform-origin: 50% 100%;
      }
    `;
    doc.head.appendChild(style);
  }

  function resolveTargets(targets, root) {
    if (typeof targets === "string") {
      return Array.from(root.querySelectorAll(targets));
    }

    if (targets instanceof Element) return [targets];
    return Array.from(targets || []);
  }

  function navFlip(targets, options) {
    if (!global.gsap) {
      throw new Error(
        "MotionKit.navFlip requires GSAP. Enable Webflow's GSAP integration before loading this file."
      );
    }

    const settings = Object.assign(
      {
        root: document,
        duration: 0.42,
        ease: "power3.out",
        perspective: 500,
        rotation: 75,
        nextStartY: 10,
        currentEndY: -110,
        nextEndY: -100,
        overlap: 0.03,
        height: "1.15em",
        lineHeight: "1.15",
        respectReducedMotion: true
      },
      options || {}
    );

    if (
      settings.respectReducedMotion &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return { count: 0, destroy: function () {} };
    }

    const root = settings.root || document;
    const doc = root.ownerDocument || document;
    const links = resolveTargets(targets, root);
    const created = [];

    addStyles(doc);

    links.forEach(function (link) {
      if (initialized.has(link)) return;

      const label = link.textContent.trim();
      if (!label) return;

      const originalHTML = link.innerHTML;
      const clip = doc.createElement("span");
      const current = doc.createElement("span");
      const next = doc.createElement("span");

      link.setAttribute("data-mk-flip-link", "");
      link.style.setProperty(
        "--mk-flip-perspective",
        settings.perspective + "px"
      );
      link.style.setProperty("--mk-flip-height", settings.height);
      link.style.setProperty("--mk-flip-line-height", settings.lineHeight);

      clip.setAttribute("data-mk-flip-clip", "");
      current.setAttribute("data-mk-flip-current", "");
      next.setAttribute("data-mk-flip-next", "");
      next.setAttribute("aria-hidden", "true");

      current.textContent = label;
      next.textContent = label;
      clip.append(current, next);
      link.replaceChildren(clip);

      global.gsap.set(next, {
        yPercent: settings.nextStartY,
        rotationX: settings.rotation
      });

      const timeline = global.gsap.timeline({
        paused: true,
        defaults: {
          duration: settings.duration,
          ease: settings.ease
        }
      });

      timeline
        .to(
          current,
          {
            yPercent: settings.currentEndY,
            rotationX: -settings.rotation
          },
          0
        )
        .to(
          next,
          {
            yPercent: settings.nextEndY,
            rotationX: 0
          },
          settings.overlap
        );

      function update() {
        const active = link.matches(":hover") || link.matches(":focus");
        active ? timeline.play() : timeline.reverse();
      }

      function destroy() {
        link.removeEventListener("mouseenter", update);
        link.removeEventListener("mouseleave", update);
        link.removeEventListener("focus", update);
        link.removeEventListener("blur", update);
        timeline.kill();
        link.innerHTML = originalHTML;
        link.removeAttribute("data-mk-flip-link");
        link.style.removeProperty("--mk-flip-perspective");
        link.style.removeProperty("--mk-flip-height");
        link.style.removeProperty("--mk-flip-line-height");
        initialized.delete(link);
      }

      link.addEventListener("mouseenter", update);
      link.addEventListener("mouseleave", update);
      link.addEventListener("focus", update);
      link.addEventListener("blur", update);

      const instance = { element: link, timeline: timeline, destroy: destroy };
      initialized.set(link, instance);
      created.push(instance);
    });

    return {
      count: created.length,
      instances: created,
      destroy: function () {
        created.forEach(function (instance) {
          instance.destroy();
        });
      }
    };
  }

  global.MotionKit = global.MotionKit || {};
  global.MotionKit.navFlip = navFlip;
  global.MotionKit.navFlipVersion = "1.0.0";
})(window);
