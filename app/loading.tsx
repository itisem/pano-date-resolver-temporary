import styles from "./loading.module.css";

export default function Loading(){
	return <>
		<div className = {styles.spinner}>
			<div></div><div></div><div></div>
		</div>
		<p>loading, please wait...</p>
	</>
}