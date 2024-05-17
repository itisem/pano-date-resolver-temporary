import type {Coordinates} from "../geo-map";

// very rudimentary parser of 1.2345,-6.789 formatted coordinates
export default function parseCoordinateString(coords: string): Coordinates{
	const coordSplit = coords.split(",");
	if(coordSplit.length !== 2) throw new Error(`Invalid coordinates ${coords}`);
	// could check elementwise, this is just nicer
	const coordFloat = coordSplit.map(x => parseFloat(x));
	if(coordFloat.some(x => isNaN(x))) throw new Error(`Invalid coordinates ${coords}`);
	if(Math.abs(coordFloat[0]) > 85) throw new Error(`Invalid coordinates ${coords}`); // google maps world boundary is [-85, 85]
	if(Math.abs(coordFloat[1]) > 180) throw new Error(`Invalid coordinates ${coords}`); // actual lng boundary is [-180, 180]
	// valid coordinates
	return {
		lat: coordFloat[0],
		lng: coordFloat[1]
	}
}