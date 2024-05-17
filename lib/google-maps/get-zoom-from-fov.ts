// converts fov to zoom value
// based on https://stackoverflow.com/a/47874903
export default function getZoomFromFOV(fov: number): number{
	if(fov > 180) throw new Error(`Invalid FOV ${fov}`);
	if(fov < 11.25) throw new Error(`Invalid FOV ${fov}`);
	return Math.log(180 / fov) / Math.log(2);
}