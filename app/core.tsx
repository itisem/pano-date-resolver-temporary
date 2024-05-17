"use client";

import {useState} from "react";
import tz from "@photostructure/tz-lookup";
import parseStreetviewUrl from "../lib/google-maps/parse-streetview-url";
import resolvePanoDate from "../lib/google-maps/resolve-pano-date";
import Loading from "./loading";
import styles from "./styles.module.css";

export default function DateResolverCore(){
	const [url, setUrl] = useState("");
	const [date, setDate] = useState({local: "", utc: "", user: ""});
	const [error, setError] = useState("");
	const [status, setStatus] = useState("");

	const resolveDate = async () => {
		// reset dates
		setStatus("loading");
		setDate({local: "", utc: "", user: ""});
		// get location information from url
		let location;
		try{
			location = parseStreetviewUrl(url);
		}
		catch{
			setStatus("error");
			setError("error while parsing location url");
			return;
		}
		// get timezone information
		const timeZone = tz(location.lat, location.lng);
		// create a timezone formatter, used for displaying datetime
		let options: any = {};
		options.year = options.month = options.day = options.hour = options.minute = options.second = "numeric";
		// use the sv-SE locale for displaying a human-readable format that is somewhat close to the iso-8601 format
		// see https://stackoverflow.com/questions/25050034/get-iso-8601-using-intl-datetimeformat
		const locale = "sv-SE";
		const utcFormatter = new Intl.DateTimeFormat(locale, {...options, timeZone: "Etc/UTC"});
		const localFormatter = new Intl.DateTimeFormat(locale, {...options, timeZone});
		const userFormatter = new Intl.DateTimeFormat(locale, {...options});
		// resolve the pano date and set times accordingly
		resolvePanoDate(location, {
			accuracy: 2
		}).then(x => {
			setStatus("finished");
			setDate({
				local: localFormatter.format(x) + " (local time at pano location)",
				utc: utcFormatter.format(x) + " (utc)",
				user: userFormatter.format(x) + " (your local time)"
			});
		}).catch(e => {
			setStatus("error");
			setError("api error while resolving pano time");
		});
	}
	return <>
		<input
			type = "text"
			placeholder = "pano url, unshortened"
			value = {url}
			onChange = {e => setUrl(e.target.value)}
			className = {styles.panoURL}
		/>
		<button
			onClick = {resolveDate}
			className = {styles.resolveButton}
		>
			resolve
		</button>
		<section className = {styles.info} style = {{display: status === "finished" ? "block" : "none"}}>
			<p className = {styles.date}>
				<b>{date.local}</b>
			</p>
			<p className = {styles.date}>
				{date.utc}
			</p>
			<p className = {styles.date}>
				{date.user}
			</p>
		</section>
		<section className = "error" style = {{display: status === "error" ? "block": "none"}}>
			{error}
		</section>
		<section className = {styles.loading} style = {{display: status === "loading" ? "block": "none"}}>
			<Loading />
		</section>
	</>
}