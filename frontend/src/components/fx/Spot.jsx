// A card whose gold spotlight follows the pointer (the glow itself is the .spotlight class in index.css).
export default function Spot({ as: Tag = "div", className = "", children, ...rest }) {
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--sx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };
  return <Tag onPointerMove={move} className={`spotlight ${className}`} {...rest}>{children}</Tag>;
}
