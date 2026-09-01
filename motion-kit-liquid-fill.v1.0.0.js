(function (global) {
  "use strict";

  const STYLE_ID = "motion-kit-liquid-fill-v1-styles";
  const initialized = new WeakMap();
  let sequence = 0;

  function addStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-mk-liquid-shell] {
        position: relative;
        display: block;
      }

      [data-mk-liquid-base],
      [data-mk-liquid-fill] {
        display: block;
      }

      [data-mk-liquid-base] {
        opacity: var(--mk-liquid-base-opacity, 0.16);
      }

      [data-mk-liquid-fill] {
        position: absolute;
        inset: 0;
        color: var(--mk-liquid-fill-color, #ff3ea5);
        pointer-events: none;
        clip-path: inset(0 100% 0 0);
        will-change: clip-path;
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

  function createStructure(element) {
    const host = getContentHost(element);
    const existing = host.querySelector(":scope > [data-mk-liquid-shell]");

    if (existing) {
      return {
        host: host,
        shell: existing,
        base: existing.querySelector("[data-mk-liquid-base]"),
        fill: existing.querySelector("[data-mk-liquid-fill]"),
        created: false
      };
    }

    const doc = element.ownerDocument;
    const shell = doc.createElement("span");
    const base = doc.createElement("span");
    const fill = doc.createElement("span");

    shell.setAttribute("data-mk-liquid-shell", "");
    base.setAttribute("data-mk-liquid-base", "");
    fill.setAttribute("data-mk-liquid-fill", "");
    fill.setAttribute("aria-hidden", "true");

    while (host.firstChild) base.appendChild(host.firstChild);
    fill.innerHTML = base.innerHTML;
    shell.append(base, fill);
    host.appendChild(shell);

    return { host: host, shell: shell, base: base, fill: fill, created: true };
  }

  function unwrapStructure(structure) {
    while (structure.base.firstChild) {
      structure.host.insertBefore(structure.base.firstChild, structure.shell);
    }
    structure.shell.remove();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function wavePolygon(progress, amplitude, frequency, phaseTurns, points) {
    if (progress <= 0) return "inset(0 100% 0 0)";
    if (progress >= 1) return "inset(0 0% 0 0)";

    const edge = progress * 100;
    const polygon = ["0% 0%"];

    for (let index = 0; index <= points; index += 1) {
      const y = (index / points) * 100;
      const angle =
        (index / points) * Math.PI * 2 * frequency +
        progress * Math.PI * 2 * phaseTurns;
      const x = clamp(edge + Math.sin(angle) * amplitude, 0, 100);
      polygon.push(x.toFixed(3) + "% " + y.toFixed(3) + "%");
    }

    polygon.push("0% 100%");
    return "polygon(" + polygon.join(", ") + ")";
  }

  function liquidFill(targets, options) {
    if (!global.gsap || !global.ScrollTrigger) {
      throw new Error(
        "MotionKit.liquidFill requires GSAP and ScrollTrigger. Enable both in Webflow's GSAP integration."
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
        fillColor: "#ff3ea5",
        baseOpacity: 0.16,
        waveAmplitude: 3,
        waveFrequency: 1.5,
        wavePhaseTurns: 1.25,
        wavePoints: 18,
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

      const structure = createStructure(element);
      if (!structure.base || !structure.fill) return;

      structure.shell.style.setProperty(
        "--mk-liquid-fill-color",
        settings.fillColor
      );
      structure.shell.style.setProperty(
        "--mk-liquid-base-opacity",
        String(settings.baseOpacity)
      );

      const state = { progress: 0 };

      function render() {
        structure.fill.style.clipPath = wavePolygon(
          state.progress,
          Number(settings.waveAmplitude),
          Number(settings.waveFrequency),
          Number(settings.wavePhaseTurns),
          Math.max(6, Number(settings.wavePoints) || 18)
        );
      }

      render();

      const tween = global.gsap.to(state, {
        progress: 1,
        ease: "none",
        onUpdate: render,
        scrollTrigger: {
          id: "mk-liquid-fill-" + ++sequence,
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

      function destroy() {
        if (tween.scrollTrigger) tween.scrollTrigger.kill();
        tween.kill();
        structure.fill.style.removeProperty("clip-path");

        if (structure.created && structure.shell.isConnected) {
          unwrapStructure(structure);
        }

        initialized.delete(element);
      }

      const instance = {
        element: element,
        container: container,
        structure: structure,
        tween: tween,
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
  global.MotionKit.liquidFill = liquidFill;
  global.MotionKit.liquidFillVersion = "1.0.0";
})(window);
