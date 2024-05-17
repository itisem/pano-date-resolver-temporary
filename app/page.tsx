import DateResolverCore from "./core";

export default function PanoDateResolver(){
	return <>
		<h1>pano date resolver</h1>
		<p className = "description">
			find out when a given pano was taken with an accuracy of up to 10 minutes. (works ~90% of the time in my experience).
		</p>
		<p className = "description">
			<b>note: this tool currently doesn't support shortened (goo.gl) links, paste the full url!</b>
		</p>
		<p className = "description">
			note: this is a placeholder url for the tool, i eventually want to bundle it with a rework of all my other mapping tools.
			when that happens, i'll turn this url into a redirect.&nbsp;
			<a href = "https://geo.emily.bz"><u>here is a link</u></a> to all my other streetview tools for the time being.
		</p>
		<DateResolverCore />
	</>
}

export const metadata = {
	title: "pano date resolver",
	description: "find when a specific google streetview panorama was taken"
};