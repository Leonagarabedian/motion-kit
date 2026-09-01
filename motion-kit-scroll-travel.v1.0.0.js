(function (global) {
  "use strict";

  const STYLE_ID = "motion-kit-scroll-travel-v1-styles";
  const initialized = new WeakMap();
  let sequence = 0;

  function addStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-mk-scroll-travel-layer] {
        display: block;
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

  function createLayer(element) {
    const existing = element.querySelector(
      ":scope > [data-mk-scroll-travel-layer]"
    );

    if (existing) return { layer: existing, created: false };

    const layer = element.ownerDocument.createElement("span");
    layer.setAttribute("data-mk-scroll-travel-layer", "");

    while (element.firstChild) layer.appendChild(element.firstChild);
    element.appendChild(layer);

    return { layer: layer, created: true };
  }

  function unwrapLayer(element, layer) {
    while (layer.firstChild) element.insertBefore(layer.firstChild, layer);
    layer.remove();
  }

  function scrollTravel(targets, options) {
    if (!global.gsap || !global.ScrollTrigger) {
      throw new Error(
        "MotionKit.scrollTravel requires GSAP and ScrollTrigger. Enable both in Webflow's GSAP integration."
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
        bottomOffset: 0,
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

      const layerResult = createLayer(element);
      const layer = layerResult.layer;

      function travelDistance() {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const containerStyle = global.getComputedStyle(container);
        const paddingBottom = parseFloat(containerStyle.paddingBottom) || 0;

        return Math.max(
          0,
          containerRect.bottom -
            paddingBottom -
            settings.bottomOffset -
            elementRect.bottom
        );
      }

      const tween = global.gsap.fromTo(
        layer,
        { y: 0 },
        {
          y: travelDistance,
          ease: "none",
          overwrite: "auto",
          scrollTrigger: {
            id: "mk-scroll-travel-" + ++sequence,
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
        }
      );

      function destroy() {
        if (tween.scrollTrigger) tween.scrollTrigger.kill();
        tween.kill();
        global.gsap.set(layer, { clearProps: "transform" });

        if (layerResult.created && layer.isConnected) {
          unwrapLayer(element, layer);
        }

        initialized.delete(element);
      }

      const instance = {
        element: element,
        container: container,
        layer: layer,
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
  global.MotionKit.scrollTravel = scrollTravel;
  global.MotionKit.scrollTravelVersion = "1.0.0";
})(window);
