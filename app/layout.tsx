import "./globals.css";

export default function RootLayout({children}: {children: React.ReactNode}){
	return (
		<html lang="en">
			<head>
				<meta charSet = "utf-8" />
			</head>
			<body>
				<main>
					{children}
				</main>
			</body>
		</html>
	)
}
