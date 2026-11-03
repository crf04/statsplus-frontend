import { forwardRef } from 'react';
import { Dropdown } from 'react-bootstrap';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './useTheme';
import './ThemeMenu.css';

const CHOICES = [
  { preference: 'system', label: 'System', Icon: Monitor },
  { preference: 'light', label: 'Light', Icon: Sun },
  { preference: 'dark', label: 'Dark', Icon: Moon },
];
const THEME_NAMES = { light: 'Light', dark: 'Dark' };
// Popper anchors the menu 8px under its button and keeps it in the viewport.
const MENU_OFFSET = { modifiers: [{ name: 'offset', options: { offset: [0, 8] } }] };

// A radio menu item: react-bootstrap marks every item aria-selected, which a
// menuitemradio does not take; aria-checked says which is chosen.
const RadioItem = forwardRef(({ 'aria-selected': _selected, ...props }, ref) => (
  <button type="button" ref={ref} {...props} />
));

/** The header's Appearance menu: System, Light or Dark. */
export default function ThemeMenu() {
  const { preference, resolved, setPreference } = useTheme();
  const { label, Icon } = CHOICES.find((choice) => choice.preference === preference);
  const name = preference === 'system' ? `${label} (${THEME_NAMES[resolved]})` : label;
  return (
    <Dropdown className="theme-menu" align="end" onSelect={setPreference}>
      <Dropdown.Toggle
        as="button"
        type="button"
        bsPrefix="theme-menu-toggle"
        aria-label={`Appearance: ${name}`}
      >
        <Icon size={16} aria-hidden="true" />
      </Dropdown.Toggle>
      <Dropdown.Menu role="menu" popperConfig={MENU_OFFSET}>
        {CHOICES.map((choice) => (
          <Dropdown.Item
            key={choice.preference}
            as={RadioItem}
            eventKey={choice.preference}
            role="menuitemradio"
            aria-checked={choice.preference === preference}
          >
            <choice.Icon size={15} aria-hidden="true" />
            <span>{choice.label}</span>
            {choice.preference === 'system' && preference === 'system' && (
              <span className="theme-menu-hint">{THEME_NAMES[resolved]}</span>
            )}
            {choice.preference === preference && (
              <Check className="theme-menu-check" size={15} aria-hidden="true" />
            )}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
