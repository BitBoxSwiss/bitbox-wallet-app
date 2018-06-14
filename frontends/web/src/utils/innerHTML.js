import { h } from 'preact';

export default function InnerHTMLHelper({ tagName, html }) {
    return h(tagName, { dangerouslySetInnerHTML: { __html: html } });
}
