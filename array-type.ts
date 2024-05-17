// typeof but with typeguards for arrayType
function typedTypeof<T>(elem: T): string{
	return typeof elem;
}

type TypeCheckerFunction<T> = (elem: T) => string;

// checks whether or not every member of an array has the same type
export default function arrayType<T>(arr: T[], fn?: TypeCheckerFunction<T>): string{
	// if no elements are present, say that the type is empty
	// intentionally avoiding existing keywords in case there is an [undefined, undefined, ...] array or whatnot
	if(arr.length === 0) return "empty";

	// if no function is present, use typeof as comparison
	// if T can include arrays, objects, this comparison isn't useful!
	// since fn can't be undefined anymore, but typescript isn't smart enough to detect it, we cast and put it into a new constant
	const finalFn: TypeCheckerFunction<T> = fn ?? typedTypeof;

	// use the first type as the base type
	// since fn can't be undefined anymore, 
	const baseType = finalFn(arr[0]);
	// if every element has the same type, return that as the element type
	// otherwise, act like it can be any type
	return arr.every((x: T) => finalFn(x) === baseType) ? baseType : "any";
}