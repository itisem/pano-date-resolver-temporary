import type {Location} from "../geo-map";

// TODO: will remove this once i turn my reverse engineering into a single module
import SingleImageSearch from "./single-image-search.json";
import Pbfish from "@gmaps-tools/pbfish";

export interface ResolvePanoDateOptions{
	reverse?: boolean; // do the search in reverse, used to ensure that some accuracy is maintained
	accuracy?: number; // time accuracy in seconds
	callback?: (dates: DateRange) => any; // callback between steps, used if every step is visualised
}

export interface DateRange{
	min: Date;
	max: Date;
}

export default async function resolvePanoDate(location: Location, options?: ResolvePanoDateOptions): Promise<Date>{
	options = options ?? {};
	// unofficial panos aren't included since they can be weird at times
	if(location.panoId && location.panoId.length !== 22) throw new Error("Only official imagery supported");
	// too much accuracy causes errors
	options.accuracy = options.accuracy ?? 3600; // default to an hour
	if(options.accuracy < 2) throw new Error("Can't have more than 1 second accuracy");

	// TODO: will rewrite this once i turn the reverse engineered stuff into a module
	const pbfish = new Pbfish(SingleImageSearch);
	const endpoint = "https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch";
	let request = pbfish.create("SingleImageSearchRequest");
	// create a base for request contents that will be used for future stuff
	const baseRequestContents = {
		context: {
			productId: "apiv3"
		},
		location: {
			center: {
				lat: location.lat,
				lng: location.lng
			},
			radius: 30
		},
		queryOptions: {
			clientCapabilities: {
				renderStrategy: [
					{frontend: "OFFICIAL", tiled: true, imageFormat: "OFFICIAL_FORMAT"} // don't support unofficial stuff
				]
			},
			rankingOptions: {
				rankingStrategy: "CLOSEST"
			}
		},
		responseSpecification: {
			component: [
				"INCLUDE_DESCRIPTION",
				"INCLUDE_LINKED_PANORAMAS"
			]
		}
	};
	// set a header for protobuf stuff
	const headers = {
		"Content-Type": "application/json+protobuf"
	};

	// set the original request's value, based on whether or not there is a panoid present
	request.value = location.panoId ? {
		...baseRequestContents,
		imageKey: {
			frontend: "OFFICIAL",
			id: location.panoId
		}
	} : baseRequestContents;

	// get the pano month
	const month = await fetch(endpoint, {
		headers,
		method: "POST",
		body: JSON.stringify(request.toArray())
	}).then(r => r.json()).then(r => {
		const response = pbfish.create("SingleImageSearchResponse");
		response.fromArray(r);
		if(response.status.code !== "OK") throw new Error("Could not resolve original panorama");
		return response.metadata.date.date;
	});

	// reset request
	request = pbfish.create("SingleImageSearchRequest");
	request.value = baseRequestContents;

	// month indices begin at 0 in js so no addition needed for month here
	let maxTimestamp = Math.round(new Date(month.year, month.month, 2).getTime() / 1000);
	let minTimestamp = Math.round(new Date(month.year, month.month - 1, 0).getTime() / 1000);

	// narrow down intervals gradually
	while(maxTimestamp - minTimestamp > options.accuracy){
		// find middle point
		const midTimestamp = Math.round((maxTimestamp + minTimestamp) / 2);
		// set the new timestamps. won't overwrite the rest of the value
		request.value = {
			queryOptions: {
				filterOptions: {
					photoAge: {
						// set the start and end time depending on whether or not the search is performed in reverse or not
						startSeconds: options.reverse ? midTimestamp : minTimestamp,
						endSeconds: options.reverse ? maxTimestamp : midTimestamp
					}
				}
			}
		};
		// check if there is imagery, set the timestamp range accordingly
		const hasImage = await fetch(endpoint, {
			headers: {
				"Content-Type": "application/json+protobuf"
			},
			method: "POST",
			body: JSON.stringify(request.toArray())
		}).then(r => r.json()).then(r => {
			const response = pbfish.create("SingleImageSearchResponse");
			response.fromArray(r);
			return response.status.code === "OK";
		});
		// set endpoint depending on whether or not it was a reverse search
		if(options.reverse){
			if(hasImage) minTimestamp = midTimestamp;
			else maxTimestamp = midTimestamp;
		}
		else{
			if(hasImage) maxTimestamp = midTimestamp;
			else minTimestamp = midTimestamp;
		}

		// call callback after each step, if there is one
		if(options.callback){
			options.callback({min: new Date(minTimestamp * 1000), max: new Date(maxTimestamp * 1000)});
		}
	}

	// return the midpoint instead of a range since the accuracy value should take care of the rest anyway
	return new Date((minTimestamp + maxTimestamp) / 2 * 1000);
}