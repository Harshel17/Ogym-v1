import { useRef, useEffect, useState } from "react";
import { useLocation } from "wouter";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionClass, setTransitionClass] = useState("page-slide-in");
  const prevLocation = useRef(location);

  useEffect(() => {
    if (prevLocation.current !== location) {
      setTransitionClass("page-fade-scale");
      setDisplayChildren(children);
      prevLocation.current = location;
    } else {
      setDisplayChildren(children);
    }
  }, [location, children]);

  return (
    <div key={location} className={transitionClass}>
      {displayChildren}
    </div>
  );
}
