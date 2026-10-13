// PROTOTYPE (throwaway): floating variant picker for the Connect prototype.
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CONNECT_VARIANTS, HOME_VARIANTS, setProto, useProto } from './protoState';
import './ProtoSwitcher.css';

const ProtoSwitcher = () => {
  const { v, h } = useProto();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(true);
  const onConnect = pathname === '/connect';
  const list = onConnect ? CONNECT_VARIANTS : HOME_VARIANTS;
  const current = onConnect ? v : h;
  const key = onConnect ? 'v' : 'h';

  if (!open) {
    return (
      <button type="button" className="ps ps-closed" onClick={() => setOpen(true)}>
        {onConnect ? `Connect ${v}` : `Home ${h}`}
      </button>
    );
  }

  return (
    <div className="ps" role="group" aria-label="Prototype variants">
      <div className="ps-head">
        <span>{onConnect ? 'Connect page' : 'Home mention'}</span>
        <button type="button" className="ps-x" onClick={() => setOpen(false)} aria-label="Hide">
          ×
        </button>
      </div>
      <div className="ps-options">
        {list.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ps-opt"
            aria-pressed={current === item.id}
            onClick={() => setProto({ [key]: item.id })}
          >
            <b>{item.id}</b> {item.label}
          </button>
        ))}
      </div>
      <Link className="ps-go" to={onConnect ? `/#v=${v}&h=${h}` : `/connect#v=${v}&h=${h}`}>
        {onConnect ? '→ Home page' : '→ Connect page'}
      </Link>
    </div>
  );
};

export default ProtoSwitcher;
