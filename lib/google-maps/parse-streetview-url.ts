import type {Location} from "../geo-map";
import parseCoordinateString from "./parse-coordinate-string";
import getZoomFromFOV from "./get-zoom-from-fov";

// TODO: will remove this once i turn my reverse engineering into a single module
import Pbfish from "@gmaps-tools/pbfish";
import StreetviewUrl from "./streetview-url.json";
const pbfish = new Pbfish(StreetviewUrl);

// constant error cause, used everywhere
const errorCause = {cause: {code: "URLParseError"}};

export default function parseStreetviewUrl(_url: string): Location{
	const url = new URL(_url);
	const baseRegex = "(-?[0-9]{1,2}.[0-9]+,-?[0-9]{1,3}.[0-9]+)";
	let params: URLSearchParams, coordStr: string | undefined;
	switch(url.pathname){
		// example url: https://www.google.com/maps?q&layer=c&cbll=32.38139602797509,-64.67713930153232
		// obtained from geoguessr itself
		case "/maps":
			params = new URLSearchParams(url.search);
			coordStr = params.get("cbll") ?? undefined; // convert from null to undefined
			// very rudimentary parsing
			if(!coordStr) throw new Error(`No coordinates in the URL ${_url}`, errorCause);
			// basic checking is done, can just do parsing
			return parseCoordinateString(coordStr) as Location;
		// example url: https://www.google.com/maps/@?api=1&map_action=pano&pano=0rQk0Art3BKf-pzcRG97vQ&viewpoint=42.241871,20.048884&heading=208.51855212082555&pitch=-0.9122728311738229&fov=90.00006749247382&shorturl=1#extra%5Btags%5D=fixed&extra%5BloadMode%5D=latLng
		// obtained from unshortening goo.gl links
		case "/maps/@":
			params = new URLSearchParams(url.search);
			// extract pano id
			let panoId = params.get("pano") ?? undefined; // convert from null to undefined
			if(panoId){
				// 22, 43, and 44 are the only known pano lengths
				// technically, no code would break if this check was removed, but it's a good sanity check
				// and also if it breaks, it will show where assumptions went wrong
				if(![22,43,44].includes(panoId.length)) throw new Error(`Invalid pano id in the URL ${_url}`, errorCause);
			}
			// extract heading
			const headingStr = params.get("heading");
			let heading: number | undefined;
			if(headingStr){
				heading = parseFloat(headingStr);
				if(isNaN(heading)) throw new Error(`Invalid heading in the URL ${_url}`, errorCause);
				// should be [-180,180], but i've seen weird outliers in the past
				if(Math.abs(heading) > 360) throw new Error(`Invalid heading in the URL ${_url}`, errorCause);
			}
			// extract pitch
			const pitchStr = params.get("pitch");
			let pitch: number | undefined;
			if(pitchStr){
				pitch = parseFloat(pitchStr);
				if(isNaN(pitch)) throw new Error(`Invalid pitch in the URL ${_url}`, errorCause);
				if(Math.abs(pitch) > 180) throw new Error(`Invalid pitch in the URL ${_url}`, errorCause);
			}
			// extract zoom, slightly more complex
			const fovStr = params.get("fov");
			let zoom: number | undefined;
			if(fovStr){
				let fov = parseFloat(fovStr);
				if(isNaN(fov)) throw new Error(`Invalid FOV in the URL ${_url}`, errorCause);
				// convert the zoom to fov
				try{
					zoom = getZoomFromFOV(fov);
				}
				catch{
					throw new Error(`Invalid FOV in the URL ${_url}`, errorCause);
				}
			}
			// extract coordinates
			coordStr = params.get("viewpoint") ?? undefined; // convert from null to undefined
			if(!coordStr) throw new Error(`No coordinates in the URL ${_url}`, errorCause);
			let {lat, lng} = parseCoordinateString(coordStr);
			// every component is parsed
			return {lat, lng, zoom, pitch, heading, panoId};
		// any other url
		// example: https://www.google.com/maps/@38.5234746,-80.2986776,3a,75y,331.39h,92.18t/data=!3m7!1e1!3m5!1sza2ea6x1zH5maYyCulgUpA!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fpanoid%3Dza2ea6x1zH5maYyCulgUpA%26cb_client%3Dmaps_sv.tactile.gps%26w%3D203%26h%3D100%26yaw%3D329.7389%26pitch%3D0%26thumbfov%3D100!7i16384!8i8192?entry=ttu
		default:
			// parse example url
			const {pathname} = url;
			if(pathname.startsWith("/maps")){ // example url
				const pathParts = pathname.split("/");
				if(!pathParts[2].startsWith("@")) throw new Error(`Unimplemented URL format in the URL ${_url}`, errorCause);
				// core parts always appear first
				const basicData = pathParts[2].replace("@","").split(",");
				// everything is always in the same order, so just parse as normal
				const lat = parseFloat(basicData[0]);
				const lng = parseFloat(basicData[1]);
				const zoom = getZoomFromFOV(parseFloat(basicData[3]));
				const heading = parseFloat(basicData[4]);
				const pitch = parseFloat(basicData[5]);
				// pano id always appears next
				const panoInfoText = pathParts[3].replace("data=","");
				const panoInfo = pbfish.create("StreetviewUrl");
				panoInfo.fromUrl(panoInfoText);
				// @ts-ignore
				const panoId = panoInfo.value.data.pano.panoId.value;
				return {lat, lng, zoom, pitch, heading, panoId};
			}
			else{
				throw new Error(`Unimplemented URL format in the URL ${_url}`, errorCause);
			}
	}
}