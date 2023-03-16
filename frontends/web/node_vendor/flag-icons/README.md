fork of 6.6.6 (https://github.com/lipis/flag-icons/commit/6dfe532a007525fc2066015eff0e1c0fab5e31f2)

with the following changes:
- smaller minified version with less precission
- removed unused 1x1 flags, sass, less and minified CSS
- remove cefta

applied upstream changes (unreleased):
- transparent np flag (https://github.com/lipis/flag-icons/commit/156838a296451807ba33c4c1c28f491e0fa19e7b)
- fix colors of cu flag (https://github.com/lipis/flag-icons/commit/2b15ede6c66cd434e8cf5b7cbcd008368c36439a)
- add white background to dg and io flags (https://github.com/lipis/flag-icons/commit/a108610f6372e5ba4c8a8f80cab39f88c676a742)
- fix do flag (https://github.com/lipis/flag-icons/commit/fee45226808177f4efabd4dba63c15239efd72a6)
- fix kz flag (https://github.com/lipis/flag-icons/commit/a6c215825966b5d3bf704033c896df47cd0b7b76)
- fix ag flag (https://github.com/lipis/flag-icons/commit/92628159a927ca03b7336295e3c88e2fae8d514a)
- fix my flag (https://github.com/lipis/flag-icons/commit/8d4410f4eae3e53b5fbca8152b1fd3a02b905063)
- remove mix-blend-mode ge flag (https://github.com/lipis/flag-icons/commit/67045023ae58d565c2d62736fef73c49c7c56ef4)
- correct green color in sa flag (https://github.com/lipis/flag-icons/commit/5c37e436109d289aa60b1d3c7a2d1f8e4c616276)

# flag-icons

> A curated collection of all country flags in SVG — plus the CSS for easier integration. See the [demo](https://flagicons.lipis.dev).

## Install

You can either [download](https://github.com/lipis/flag-icons/archive/main.zip) the whole project as is or install it via npm or Yarn:

```bash
npm install flag-icons
# or
yarn add flag-icons
```

## Usage

First, you need to import css:

```js
import "/node_modules/flag-icons/css/flag-icons.min.css";
```

For using the flags inline with text add the classes `.fi` and `.fi-xx` (where `xx` is the [ISO 3166-1-alpha-2 code](https://www.iso.org/obp/ui/#search/code/) of a country) to an empty `<span>`. If you want to have a squared version flag then add the class `fis` as well. Example:

```html
<span class="fi fi-gr"></span> <span class="fi fi-gr fis"></span>
```

You could also apply this to any element, but in that case you'll have to use the `fib` instead of `fi` and you're set. This will add the correct background with the following CSS properties:

```css
background-size: contain;
background-position: 50%;
background-repeat: no-repeat;
```

Which means that the flag is just going to appear in the middle of an element, so you will have to set manually the correct size of 4 by 3 ratio or if it's squared add also the `flag-icon-squared` class.

## Development

Run the `yarn` to install the dependencies after cloning the project and you'll be able to:

To build `*.less` files

```bash
$ yarn build
```

To serve it on `localhost:8000`

```bash
$ yarn start
```

To have only specific countries in the css file, remove the ones that you don't need from the [`flag-icons-list.less`](less/flag-icons-list.less) file and build it again.

## Credits

- This project wouldn't exist without the awesome and now deleted collection of SVG flags by [koppi](https://github.com/koppi).
- Thank you [Andrejs Abrickis](https://twitter.com/andrejsabrickis) for providing the `flag-icons` name on [npm](https://www.npmjs.com/package/flag-icons).
