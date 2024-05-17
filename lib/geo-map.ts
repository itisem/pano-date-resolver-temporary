import parseCoordinateString from "./google-maps/parse-coordinate-string";
import parseStreetviewURL from "./google-maps/parse-streetview-url";
//import type GeoSelection from "./geo-selection";

/********** location types **********/

// pure coordinates
export interface Coordinates{
	lat: number;
	lng: number;
}

// full location info
export interface Location extends Coordinates{
	heading?: number;
	pitch?: number;
	zoom?: number;
	panoId?: string;
	panoDate?: string;
	tags?: string[];
}

export interface MMALocation{
	id: number;
	author: number;
	location: Coordinates;
	heading: number;
	pitch: number;
	zoom: number;
	panoId: string;
	createdAt: string;
	flags: number;
	tags: string[];
}

// location info with tags using the export format
export interface LocationWithExtra extends Location{
	extra?: {
		tags?: string[];
	};
}

/********** import/export types **********/

// slashp import script
interface CommonJSONMap{
	customCoordinates: LocationWithExtra[];
	name?: string;
	extra?: {
		tags?: any;
	};
};

// map-making.app map
type MMAMap = MMALocation[];

// official geoguessr json
type OfficialMap = LocationWithExtra[];

// pano-links.vercel.app
interface PanoLinksMap{
	[key: string]: {
		lat: number;
		lng: number;
		date?: string;
	};
};

/********** option types **********/
// options for adding a loaded map
interface AdditionOptions{
	replaceLocations?: boolean;
}

// options for .apply
export interface ApplyOptions{
	chunkSize?: number;
	chunkCallback?: (stats: ApplyStats) => void;
};

// options for exporting a map
interface ExportOptions{
	format?: string; // what format to export under
	maxLocations?: number;
	exportErrors?: boolean; // export errors instead of locations
}

interface ExportPartOptions{
	offset?: number;
	format?: string;
}

// options for loading a map
interface LoadOptions extends AdditionOptions{
	// map-making.app id
	appId?: number;
	// loaded filename (excl. extension)
	fileName?: string;
	// map name
	name?: string;
}

/********** miscellaneous types **********/

// chunk format
interface Chunk<T>{
	offset: number;
	locations: T[];
}

/********** .apply **********/

export interface ApplyStats{
	total: number;
	success: number;
};

interface ApplyError{
	location: Location;
	message: string;
};

// also changes upon import, and location set
export interface MapChangeEvent{
	// new location count, if the thing got resized
	resize?: number;
	// was every location reset?
	reset?: boolean;
	// changes
	locationChanges?: {
		// location index within GeoMap
		index: number;
		// a simple numerical representation of what happened to each location
		// added together from the enum values of LocationChangeAction
		action: number;
	}[];
};

export enum LocationChangeAction{
	LatLng = 1,
	PanoId = 2,
	PanoDate = 4,
	Heading = 8,
	Pitch = 16,
	Zoom = 32,
	Tags = 64
};

/********** core class **********/

export default class GeoMap{
	// null = apply error happened. kept the index there to make selections work easier
	protected _locations: (Location | null)[];
	protected _locationCount: number;
	// locations that errored in an apply. just a pure list, no nullification
	protected _errors: Location[];
	// map name
	name?: string;
	// map filename
	fileName?: string;
	// map-making.app id
	appId?: number;
	// selections
	//selections?: {[key: string]: GeoSelection};

	constructor(){
		// make the new map do nothing originally
		this._locations = [];
		this._errors = [];
		this._locationCount = 0;
		//this.selections = {};
	}

	/********** import and export **********/

	// since locationCount is specified separately, do safe getters/setters for locations

	set locations(locs: Location[]){
		this._locations = locs;
		this._locationCount = locs.length;
	}

	get locations(): (Location|null)[]{
		return this._locations;
	}

	get locationCount(): number{
		return this._locationCount;
	}

	get errors(): Location[]{
		return this._errors;
	}

	// generic load function
	import(text: string, options?: LoadOptions): void{
		options = options ?? {};
		try{
			let parsed = JSON.parse(text);
			// slashp import format w/ full info
			// afaik this is the only format with customCoordinates
			if(parsed.customCoordinates) return this.importCommonJSONMap(parsed as CommonJSONMap, options);
			// the two array-based formats are the official geoguessr export format and the /api/locations format on mma
			if(Array.isArray(parsed)){
				// mma locations have an id and an author and a createdAt flag which geoguessr ones don't, and location instead of lat/lng
				// i use location here to differentiate
				// official geoguessr map, same format as slashp but w/o custom coordinates
				if(parsed.length === 0 || parsed[0].location === undefined) return this.importGeoMap(parsed as OfficialMap, options);
				// map-making.app format
				else return this.importMMAMap(parsed as MMAMap, options);
			}
			// if nothing else works, assume that it is the pano-links format
			// will fail if it's incorrect
			return this.importPanoLinksMap(parsed as PanoLinksMap, options);
		}
		catch(e: any){
			// detect errors coming from import modules
			if(e.cause){
				if(e.cause.code === "LocationError" || e.cause.code === "ImportError"){
					throw e;
				}
			}
			// the only non-json format is the official csv map, so let's try parsing it as such
			return this.importCSVMap(text, options);
		}
	}

	// loading (parsed) slashp import formatted maps
	private importCommonJSONMap(map: CommonJSONMap, options: LoadOptions): void{
		const newLocations = this.fixAndValidateLocations(map.customCoordinates);
		const {replaceLocations} = options;
		// overwrite map info
		this.appId = options.appId ?? this.appId;
		this.fileName = options.fileName ?? this.fileName;
		this.name = options.name ?? map.name ?? this.name;
		// add locations
		this.addLocations(newLocations, {replaceLocations});
	}

	// loading maps from the map-making.app api
	private importMMAMap(map: MMAMap, options: LoadOptions): void{
		const newTmpLocations: LocationWithExtra[] = map.map(x => ({
			lat: x.location.lat,
			lng: x.location.lng,
			pitch: x.pitch,
			heading: x.heading,
			zoom: x.zoom,
			panoId: x.flags % 2 ? x.panoId : undefined, // locs that actually *should* be pano id'd have a 1 bit at the end
			tags: x.tags
		}));
		const newLocations = this.fixAndValidateLocations(newTmpLocations);
		const {replaceLocations} = options;
		// overwrite map info, can contain any settings since it's from mma
		this.appId = options.appId ?? this.appId;
		this.fileName = options.fileName ?? this.fileName;
		this.name = options.name ?? this.name;
		// add locations
		this.addLocations(newLocations, {replaceLocations});
	}

	// loading official geoguessr.com json formatted maps
	private importGeoMap(map: OfficialMap, options: LoadOptions): void{
		const newLocations = this.fixAndValidateLocations(map);
		const {replaceLocations} = options;
		// overwrite map info
		// appId is not set since this type of import cannot originate from map-making.app
		// name is not set since this type of import never originates from a place where map name is stored
		this.fileName = options.fileName ?? this.fileName;
		if(options.appId) throw new Error("Map-making.app maps cannot be imported from Geoguessr-formatted JSON", {cause: {code: "ImportError"}});
		if(options.name) throw new Error("Geoguessr-formatted JSONs don't contain name information", {cause: {code: "ImportError"}});
		// add locations
		this.addLocations(newLocations, {replaceLocations});
	}

	// loading pano-links.vercel.app weirdly formatted jsons
	private importPanoLinksMap(map: PanoLinksMap, options: LoadOptions): void{
		const newTmpLocations: LocationWithExtra[] = Object.entries(map).map(([panoId, data]) => ({
			panoId,
			lat: data.lat,
			lng: data.lng,
			extra: {
				tags: data.date ? [data.date] : []
			}
		}));
		const newLocations = this.fixAndValidateLocations(newTmpLocations);
		const {replaceLocations} = options;
		// overwrite map info
		// appId is not set since this type of import cannot originate from map-making.app
		// name is not set since this type of import never originates from a place where map name is stored
		this.fileName = options.fileName ?? this.fileName;
		if(options.appId) throw new Error("Map-making.app maps cannot be imported from Pano-links JSON", {cause: {code: "ImportError"}});
		if(options.name) throw new Error("Pano-links JSONs don't contain name information", {cause: {code: "ImportError"}});
		// add locations
		this.addLocations(newLocations, {replaceLocations});
	}

	// loading csv formatted maps
	private importCSVMap(text: string, options: LoadOptions): void{
		// this solution is really quite dumb and unelegant
		// however, "modern" csv parsing solutions in js are all async, which does not work very well for us
		// since the json-based imports are all sync
		// i may move everything over to async at some point, but for now, this suffices
		let parsed: LocationWithExtra[];
		const lines: string[] = text.split(/\r?\n/).filter(x => !!x);
		try{
			// parse each line individually
			parsed = lines.map(x => {
				try{
					// first, try parsing it as a coordinate string
					return parseCoordinateString(x) as Location;
				}
				catch{
					// if that fails, try streetview url
					try{
						return parseStreetviewURL(x) as Location;
					}
					// if everything fails, fail
					catch{
						throw new Error("Invalid line");
					}
				}
			});
		}
		catch{
			throw new Error("Invalid line format", {cause: {code: "FormatError"}})
		}
		const newLocations = this.fixAndValidateLocations(parsed);
		const {replaceLocations} = options;
		// overwrite map info
		// appId is not set since this type of import cannot originate from map-making.app
		// name is not set since this type of import never originates from a place where map name is stored
		this.fileName = options.fileName ?? this.fileName;
		if(options.appId) throw new Error("Map-making.app maps cannot be imported from CSV", {cause: {code: "ImportError"}});
		if(options.name) throw new Error("CSV maps don't contain name information", {cause: {code: "ImportError"}});
		// add locations
		this.addLocations(newLocations, {replaceLocations});
	}

	// validating locations before addition
	private fixAndValidateLocations(locations: LocationWithExtra[]): Location[]{
		// these are the only pano id lengths i have seen
		// length validity checking can be removed in the future, but for now, it helps i think
		const validPanoLengths = [22, 43, 44];
		// ensures that all locations are valid
		// errors are not handled within loaders, they must be handled elsewhere
		let newLocations: Location[] = [];
		for(let location of locations){
			let {lat, lng, pitch, heading, zoom, panoId, extra, tags} = location;
			// make sure that the location exists
			if(lat === undefined) throw new Error("All locations require coordinates", {cause: {code: "LocationError", location}});
			if(lng === undefined) throw new Error("All locations require coordinates", {cause: {code: "LocationError", location}});
			// google maps' world bounds are [-85, +85], which also applies for imagery iirc
			if(Math.abs(lat) > 85) throw new Error(`Invalid coordinates ${lat}, ${lng}`, {cause: {code: "LocationError", location}});
			if(Math.abs(lng) > 180) throw new Error(`Invalid coordinates ${lat}, ${lng}`, {cause: {code: "LocationError", location}});
			if(pitch){
				// pitch is limited to a [-90, 90] range on google maps
				if(Math.abs(pitch) > 90) throw new Error(`Invalid pitch ${pitch} (${lat}, ${lng})`, {cause: {code: "LocationError", location}});
			}
			if(zoom){
				// zoom is in a [0, 4] range. doesn't have to be int
				if(zoom > 4) throw new Error(`Invalid zoom ${zoom}`, {cause: {code: "LocationError", location}});
				if(zoom < 0) throw new Error(`Invalid zoom ${zoom}`, {cause: {code: "LocationError", location}});
			}
			if(heading){
				// heading is in a [-360, 360] range. should be [-180, 180] but i saw some weird ones before
				if(Math.abs(heading) > 360) throw new Error(`Invalid heading ${heading}`, {cause: {code: "LocationError", location}});
			}
			// initialise tags
			if(!tags) tags = [];
			if(extra){
				if(Array.isArray(extra.tags)) tags = [...tags, ...extra.tags];
			}
			if(tags.some(x => typeof x !== "string")) throw new Error("All tags need to be strings", {cause: {code: "LocationError", location}});
			if(tags.length === 0) tags = undefined;
			// ensure that panoid is correct
			if(panoId){
				if(!validPanoLengths.includes(panoId.length)) throw new Error(`Invalid pano id ${panoId}`, {cause: {code: "LocationError", location}});
			}
			newLocations.push({lat, lng, pitch, heading, zoom, panoId, tags});
		}
		return newLocations;
	}

	// add locations to map
	private addLocations(newLocations: Location[], options?: AdditionOptions): void{
		// assumes that locations are validated from inside a load function
		// defaults to replacement
		if(options?.replaceLocations ?? true){
			this._locations = newLocations;
			this._locationCount = newLocations.length;
		}
		else{
			this._locations.push(...newLocations);
			this._locationCount += newLocations.length;
		}
	}

	// export locations
	export(options?: ExportOptions): string | string[]{
		options = options ?? {};
		// get list of non-null locations to export (or errors if that's what we want)
		const exportedLocations = options.exportErrors ? this._errors : this._locations.filter(x => x!== null) as Location[];
		// if there is no location cap, just return everything at once
		if(!options.maxLocations || options.maxLocations <= 0) return this.exportPart(exportedLocations, {format: options.format});
		// if there is a cap, return an array of stuff
		let exported: string[] = [];
		for(let chunk of this.getChunks(exportedLocations, options.maxLocations)){
			exported.push(this.exportPart(chunk.locations as Location[], {format: options.format, offset: chunk.offset}));
		}
		return exported;
	}

	// moves tags from .tags to .extra.tags, to be used for manual map-making.app imports and whatnot
	private moveTagsToExtra(location: Location): LocationWithExtra{
		// making a copy since we don't want an export to completely mess with every location in case something needs to be changed later
		let newLocation: LocationWithExtra = {...location};
		newLocation.extra = {};
		newLocation.extra.tags = newLocation.tags;
		delete newLocation.tags;
		return newLocation;
	}

	// exports one individual chunk
	private exportPart(locations: Location[], options: ExportPartOptions): string{
		// some default settings
		const format = (options.format ?? "").toLowerCase();
		const offset = options.offset ?? 0;
		switch(format){
			// csv export. just like with imports, the nasty sync solution works better for my usecase
			// will probably clean it up at some point
			case "csv":
				return locations.map(x => `${x.lat},${x.lng}`).join("\n");
				break;
			// a map-making.app edits object
			case "mmaedits":
				const exportTime = new Date().toISOString();
				return JSON.stringify(locations.map((x, i) => ({
					id: -i - offset - 1,
					// mma stores stuff slightly weirdly
					location: {
						lat: x.lat,
						lng: x.lng
					},
					// mma requires everything to be set and not undefined
					panoId: x.panoId ?? null,
					heading: x.heading ?? 0,
					pitch: x.pitch ?? 0,
					zoom: x.zoom ?? 0,
					// mma requires a creation date
					createdAt: exportTime,
					// currently, flags are only used for the presence of panoids
					flags: x.panoId ? 1 : 0,
					tags: x.tags ?? []
				})));
			// default geoguessr import
			case "geoguessr":
				return JSON.stringify(locations.map(x => this.moveTagsToExtra(x)));
			// import script version
			case "":
			case "commonjson":
				return JSON.stringify({
					name: this.name,
					customCoordinates: locations.map(x => this.moveTagsToExtra(x))
				});
			// throw on invalid imports
			default:
				throw new Error("Invalid format - must be one of \"csv\", \"geoguessr\", \"commonjson\", \"mmaedits\"", {cause: {code: "FormatError"}});
		}
		return "";
	}

	// chunk the locations
	private *getChunks<T>(locations: T[], chunkSize: number): IterableIterator<Chunk<T>>{
		for(let i = 0; i < locations.length; i += chunkSize){
			yield {
				offset: i,
				locations: locations.slice(i, i + chunkSize)
			};
		}
	}

	/****** CUSTOM OPERATIONS ******/
	async apply(fn: (location: Location) => Promise<Location>, options?: ApplyOptions): Promise<ApplyStats>{
		const startLocations = this._locationCount;
		// always chunking makes everything a lot easier
		options = options ?? {};
		let errors: ApplyError[] = [];
		// used for stats since completed cannot be based on chunks anymore
		let completed: number = 0;
		// simplifying chunking
		const chunkSize = options?.chunkSize ?? Number.MAX_SAFE_INTEGER;
		for(let chunk of this.getChunks(this._locations, chunkSize)){
			const promises = chunk.locations.map(x => {
				if(x === null) return Promise.resolve();
				// not null, safe to typecast to Location
				else return fn(x as Location);
			});
			const results = await Promise.allSettled(promises);
			let i = 0;
			for(let result of results){
				if(result.status === "rejected"){
					// tag with error message. non-null assertion is safe since null locations resolve with undefined
					this._locations[chunk.offset + i]!.tags = [result.reason.toString()];
					// add location to errors
					this._errors.push({
						...this._locations[chunk.offset + i]
					} as Location);
					// delete location by nulling it (to make selections more sane)
					this._locations[chunk.offset + i] = null;
					// remove from location count
					this._locationCount -= 1;
					// add as completed (even if it's an error)
					completed += 1;
				}
				else{
					// the promise is resolved as undefined iff the location was null (i.e. deleted)
					// ensure that things are only changed when it was a real location
					if(result.value !== undefined){
						this._locations[chunk.offset + i] = result.value;
						completed += 1;
					}
				}
				i += 1;
			}
			// do callback after each chunk if requested
			if(options.chunkCallback){
				// number of completed locations
				options.chunkCallback({
					total: completed,
					// calculate errors from locationCount change
					success: completed + this._locationCount - startLocations
				});
			}
		}
		// return results
		return {
			total: startLocations,
			// calculate errors from locationCount change
			success: startLocations + this._locationCount - startLocations
		};
	}
}