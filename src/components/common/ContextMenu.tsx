import React, { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label?: string;
  disabled?: boolean;
  separator?: boolean;
  bold?: boolean;
  onClick?: () => void;
  children?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const SubMenu: React.FC<{
  items: ContextMenuItem[];
  parentRect: DOMRect;
  onClose: () => void;
}> = ({ items, parentRect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: parentRect.right + 1, top: parentRect.top });

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      let left = parentRect.right + 1;
      let top = parentRect.top;
      if (left + rect.width > window.innerWidth) {
        left = parentRect.left - rect.width - 1;
      }
      if (top + rect.height > window.innerHeight) {
        top = window.innerHeight - rect.height - 4;
      }
      setPos({ left, top });
    }
  }, [parentRect]);

  return (
    <div className="contextMenu" ref={ref} style={{ left: pos.left, top: pos.top, position: 'fixed' }}>
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="contextMenu-separator" />
        ) : (
          <div
            key={i}
            className={`contextMenu-item${item.disabled ? ' disabled' : ''}`}
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick();
              }
              onClose();
            }}
          >
            {item.label ?? ''}
          </div>
        ),
      )}
    </div>
  );
};

const MenuItemWithSub: React.FC<{
  item: ContextMenuItem;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const handleMouseEnter = () => {
    setHovering(true);
    if (ref.current) {
      setRect(ref.current.getBoundingClientRect());
    }
  };

  return (
    <div
      ref={ref}
      className={`contextMenu-item has-submenu${item.disabled ? ' disabled' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovering(false)}
    >
      {item.label ?? ''}
      <span className="submenu-arrow">&#9656;</span>
      {hovering && rect && item.children && (
        <SubMenu items={item.children} parentRect={rect} onClose={onClose} />
      )}
    </div>
  );
};

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        ref.current.style.left = `${window.innerWidth - rect.width - 4}px`;
      }
      if (rect.bottom > window.innerHeight) {
        ref.current.style.top = `${window.innerHeight - rect.height - 4}px`;
      }
    }
  }, [x, y]);

  return (
    <>
      <div
        className="contextMenu-overlay"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className="contextMenu" ref={ref} style={{ left: x, top: y }}>
        {items.map((item, i) =>
          item.separator ? (
            <div key={i} className="contextMenu-separator" />
          ) : item.children ? (
            <MenuItemWithSub key={i} item={item} onClose={onClose} />
          ) : (
            <div
              key={i}
              className={`contextMenu-item${item.disabled ? ' disabled' : ''}${item.bold ? ' bold' : ''}`}
              onClick={() => {
                if (!item.disabled && item.onClick) {
                  item.onClick();
                }
                onClose();
              }}
            >
              {item.label ?? ''}
            </div>
          ),
        )}
      </div>
    </>
  );
};
