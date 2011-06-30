# XmlStream

XmlStream is a Node.js XML stream parser and editor, based on
[node-expat](https://github.com/astro/node-expat) (libexpat SAX parser
binding).

## Rationale

When working with large XML files, it is probably a bad idea to use an XML to
JavaScript object converter, or simply buffer the whole document in memory.
Then again, a typical SAX parser might be too low-level for some tasks (and
often a real pain).

This is why we've rolled our own stream parser that tries to address these
shortcomings. It processes an XML stream chunk by chunk and fires events only
for nodes of interest, matching them with CSS-like selectors.

## Events

Supported events:

* `data` on outgoing data chunk,
* `end` when parsing has ended,
* `startElement[: selector]` on opening tag for selector match,
* `updateElement[: selector]` on finished node for selector match
  with its contents buffered,
* `endElement[: selector]` on closing tag for selector match,
* `text[: selector]` on tag text for selector match.

When adding listeners for `startElement`, `updateElement`, and `text` the
callback can modify the provided node, before it is sent to the consumer.

Selector syntax is CSS-like and currently supports:

* `ancestor descendant`
* `parent > child`

Take a look at the examples for more information.
