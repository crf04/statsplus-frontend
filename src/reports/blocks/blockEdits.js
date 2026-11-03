import { cardLabel } from '../reportText';

/*
 * What Edit mode can change in a block (crf04/statsplus#380): the cards a
 * `cards`, `spot` or `items` block published, reordered or removed. An items
 * block's cards are those of its items, each once, in document order.
 */
export const editableCards = (block) => {
  if (block.type === 'cards' || block.type === 'spot') return block.cards;
  if (block.type === 'items') return [...new Set(block.items.flatMap((item) => item.cards))];
  return [];
};

const SNIPPET = 60;
const plain = (text) => text.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
const snippet = (text) => {
  const chars = [...plain(text)];
  return chars.length > SNIPPET ? `${chars.slice(0, SNIPPET).join('')}…` : chars.join('');
};

/* How Edit mode names a block: its kind and enough of its words to find it. */
export const blockLabel = (block, calls) => {
  switch (block.type) {
    case 'heading':
      return `Heading: ${block.text}`;
    case 'paragraph':
      return `${block.lede ? 'Lede' : 'Paragraph'}: ${snippet(block.text)}`;
    case 'list':
      return `List: ${snippet(block.items.join(' · '))}`;
    case 'callout':
      return `Callout: ${block.title || snippet(block.text)}`;
    case 'card':
      return `Card: ${block.card ? cardLabel(calls[block.card]) : 'not available'}`;
    case 'cards':
      return `Cards: ${block.cards.map((id) => cardLabel(calls[id])).join(', ')}`;
    case 'spot':
      return block.title;
    case 'table':
      return `Table: ${block.columns.join(' · ')}`;
    case 'items':
      return `Items: ${snippet(block.items.map((item) => item.title).join(' · '))}`;
    case 'sources':
      return 'Sources';
    case 'tabs':
      return `Tabs: ${block.tabs.map((tab) => tab.title).join(' · ')}`;
    default:
      return block.type;
  }
};
