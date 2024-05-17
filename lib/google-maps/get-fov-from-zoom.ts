// converts zoom to fov value
// based on https://stackoverflow.com/a/47874903
export default function getFOVFromZoom(zoom: number): number{
	if(zoom < 0) throw new Error(`Invalid zoom ${zoom}`);
	if(zoom > 4) throw new Error(`Invalid zoom ${zoom}`);
	return 180 / Math.pow(2, zoom);
}