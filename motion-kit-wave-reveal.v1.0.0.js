(function (global) {
  "use strict";

  const STYLE_ID = "motion-kit-wave-reveal-v1-styles";
  const initialized = new WeakMap();
  let sequence = 0;

  function addStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-mk-wave-shell] {
        position: relative;
        display: block;
        overflow: hidden;
        isolation: isolate;
      }

      [data-mk-wave-text] {
        display: block;
        will-change: clip-path;
      }

      [data-mk-wave-sweep] {
        position: absolute;
        z-index: 2;
        top: 0;
        bottom: 0;
        left: 0;
        width: var(--mk-wave-width, 12%);
        min-width: var(--mk-wave-min-width, 1.25rem);
        pointer-events: none;
        border-radius: 50%;
        background: linear-gradient(
          90deg,
          transparent 0%,
          var(--mk-wave-color, #ff3ea5) 38%,
          var(--mk-wave-color, #ff3ea5) 62%,
          transparent 100%
        );
        filter: blur(var(--mk-wave-blur, 3px));
        will-change: transform;
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

  function resolveContainer(element, containerOption) {
    if (containerOption instanceof Element) return containerOption;

    if (typeof containerOption === "string") {
      return (
        element.closest(containerOption) ||
        element.ownerDocument.querySelector(containerOption)
      );
    }

    return element.closest("section") || element.parentElement;
  }

  function getContentHost(element) {
    return (
      element.querySelector(":scope > [data-mk-scroll-travel-layer]") ||
      element
    );
  }

  function createWaveStructure(element) {
    const host = getContentHost(element);
    const existing = host.querySelector(":scope > [data-mk-wave-shell]");

    if (existing) {
      return {
        host: host,
        shell: existing,
        text: existing.querySelector("[data-mk-wave-text]"),
        wave: existing.querySelector("[data-mk-wave-sweep]"),
        created: false
      };
    }

    const doc = element.ownerDocument;
    const shell = doc.createElement("span");
    const text = doc.createElement("span");
    const wave = doc.createElement("span");

    shell.setAttribute("data-mk-wave-shell", "");
    text.setAttribute("data-mk-wave-text", "");
    wave.setAttribute("data-mk-wave-sweep", "");
    wave.setAttribute("aria-hidden", "true");

    while (host.firstChild) text.appendChild(host.firstChild);
    shell.append(text, wave);
    host.appendChild(shell);

    return {
      host: host,
      shell: shell,
      text: text,
      wave: wave,
      created: true
    };
  }

  function unwrapWaveStructure(structure) {
    while (structure.text.firstChild) {
      structure.host.insertBefore(structure.text.firstChild, structure.shell);
    }
    structure.shell.remove();
  }

  function waveReveal(targets, options) {
    if (!global.gsap || !global.ScrollTrigger) {
      throw new Error(
        "MotionKit.waveReveal requires GSAP and ScrollTrigger. Enable both in Webflow's GSAP integration."
      );
    }

    global.gsap.registerPlugin(global.ScrollTrigger);

    const settings = Object.assign(
      {
        root: document,
        container: null,
        start: "top top",
        end: null,
        scrub: true,
        color: "#ff3ea5",
        waveWidth: "12%",
        waveMinWidth: "1.25rem",
        blur: "3px",
        markers: false,
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
    const elements = resolveTargets(targets, root);
    const created = [];

    addStyles(doc);

    elements.forEach(function (element) {
      if (initialized.has(element)) return;

      const container = resolveContainer(element, settings.container);
      if (!container) return;

      const structure = createWaveStructure(element);
      if (!structure.text || !structure.wave) return;

      structure.shell.style.setProperty("--mk-wave-color", settings.color);
      structure.shell.style.setProperty("--mk-wave-width", settings.waveWidth);
      structure.shell.style.setProperty(
        "--mk-wave-min-width",
        settings.waveMinWidth
      );
      structure.shell.style.setProperty("--mk-wave-blur", settings.blur);

      const timeline = global.gsap.timeline({
        scrollTrigger: {
          id: "mk-wave-reveal-" + ++sequence,
          trigger: container,
          start: settings.start,
          end:
            settings.end ||
            function () {
              return "+=" + Math.max(1, container.offsetHeight);
            },
          scrub: settings.scrub,
          invalidateOnRefresh: true,
          markers: settings.markers
        }
      });

      timeline
        .fromTo(
          structure.text,
          { clipPath: "inset(0 100% 0 0)" },
          { clipPath: "inset(0 0% 0 0)", ease: "none" },
          0
        )
        .fromTo(
          structure.wave,
          { xPercent: -100, x: 0 },
          {
            xPercent: 0,
            x: function () {
              return structure.shell.clientWidth;
            },
            ease: "none"
          },
          0
        );

      function destroy() {
        if (timeline.scrollTrigger) timeline.scrollTrigger.kill();
        timeline.kill();
        global.gsap.set([structure.text, structure.wave], {
          clearProps: "transform,clipPath"
        });

        if (structure.created && structure.shell.isConnected) {
          unwrapWaveStructure(structure);
        }

        initialized.delete(element);
      }

      const instance = {
        element: element,
        container: container,
        structure: structure,
        timeline: timeline,
        destroy: destroy
      };

      initialized.set(element, instance);
      created.push(instance);
    });

    global.ScrollTrigger.refresh();

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
  global.MotionKit.waveReveal = waveReveal;
  global.MotionKit.waveRevealVersion = "1.0.0";
})(window);
