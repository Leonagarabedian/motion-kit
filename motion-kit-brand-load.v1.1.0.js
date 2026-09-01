(function (global) {
  "use strict";

  const STYLE_ID = "motion-kit-brand-load-v1-1-styles";
  const initialized = new WeakMap();

  function addStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-mk-brand-letter] {
        display: inline-block;
        transform-origin: 50% 50%;
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

  function wrapSelectedLetters(element, selectedLetters) {
    const doc = element.ownerDocument;
    const walker = doc.createTreeWalker(
      element,
      doc.defaultView.NodeFilter.SHOW_TEXT
    );
    const textNodes = [];
    const wrappedLetters = [];
    let node;

    while ((node = walker.nextNode())) {
      if (node.nodeValue) textNodes.push(node);
    }

    textNodes.forEach(function (textNode) {
      const fragment = doc.createDocumentFragment();
      let changed = false;

      Array.from(textNode.nodeValue).forEach(function (character) {
        if (selectedLetters.has(character)) {
          const span = doc.createElement("span");
          span.setAttribute("data-mk-brand-letter", character);
          span.textContent = character;
          fragment.appendChild(span);
          wrappedLetters.push(span);
          changed = true;
        } else {
          fragment.appendChild(doc.createTextNode(character));
        }
      });

      if (changed) textNode.replaceWith(fragment);
    });

    return wrappedLetters;
  }

  function brandLoad(targets, options) {
    if (!global.gsap) {
      throw new Error(
        "MotionKit.brandLoad requires GSAP. Enable Webflow's GSAP integration before loading this file."
      );
    }

    const settings = Object.assign(
      {
        root: document,
        letters: "BTA",
        duration: 1.15,
        stagger: 0.14,
        delay: 0.1,
        rotation: 360,
        ease: "power3.out",
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
    const selectedLetters = new Set(Array.from(settings.letters));
    const created = [];

    addStyles(doc);

    elements.forEach(function (element) {
      if (initialized.has(element)) return;

      const originalHTML = element.innerHTML;
      const letters = wrapSelectedLetters(element, selectedLetters);
      if (!letters.length) return;

      const timeline = global.gsap.timeline({ delay: settings.delay });

      timeline.fromTo(
        letters,
        {
          rotation: function (index) {
            return index % 2 === 0
              ? -settings.rotation
              : settings.rotation;
          }
        },
        {
          rotation: 0,
          duration: settings.duration,
          ease: settings.ease,
          stagger: settings.stagger,
          clearProps: "transform"
        }
      );

      function destroy() {
        timeline.kill();
        element.innerHTML = originalHTML;
        initialized.delete(element);
      }

      const instance = {
        element: element,
        letters: letters,
        timeline: timeline,
        destroy: destroy
      };

      initialized.set(element, instance);
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
  global.MotionKit.brandLoad = brandLoad;
  global.MotionKit.brandLoadVersion = "1.1.0";
})(window);
