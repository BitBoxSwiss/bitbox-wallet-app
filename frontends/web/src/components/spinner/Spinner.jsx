import { Component } from 'preact';
import style from './Spinner.css';


export default class Spinner extends Component {
	componentWillMount() {
		document.addEventListener('keydown', this.handleKeyDown);
	}

	componentWillUnmount() {
		document.removeEventListener('keydown', this.handleKeyDown);
	}

	handleKeyDown = e => {
		e.preventDefault();
		document.activeElement.blur();
	}

	render({
		text,
	}, {

	}) {
		return (
			<div class={style.spinnerContainer}>
				{
					text && (
						<p class={style.spinnerText}>{text}</p>
					)
				}
				<div class={style.spinner}>
					<div></div>
					<div></div>
					<div></div>
					<div></div>
				</div>
			</div>
		);
	}
}
