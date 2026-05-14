import { useEffect, useRef } from "react";
import anime from "animejs";

/**
 * Wraps its children in a scroll-triggered stagger reveal.
 * Add `data-animate` to each direct child you want animated.
 *
 * @param {string}  className   - Extra classes for the container div
 * @param {number}  staggerMs   - Delay between each child in ms (default 70)
 * @param {number}  delay       - Overall start delay in ms (default 0)
 */
const AnimatedSection = ({
  children,
  className = "",
  staggerMs = 70,
  delay = 0,
}) => {
  const ref = useRef(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = el.querySelectorAll("[data-animate]");
    if (!targets.length) return;

    /* Hide all targets immediately */
    targets.forEach((t) => {
      t.style.opacity = "0";
      t.style.transform = "translateY(22px)";
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          anime({
            targets,
            opacity: [0, 1],
            translateY: [22, 0],
            duration: 700,
            delay: anime.stagger(staggerMs, { start: delay }),
            easing: "easeOutExpo",
          });
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [staggerMs, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};

export default AnimatedSection;
