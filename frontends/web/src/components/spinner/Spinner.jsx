import { Component } from 'preact';
import style from './Spinner.css';


export default class Spinner extends Component {
	render() {
		return (
			<div class={style.spinnerContainer}>
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
