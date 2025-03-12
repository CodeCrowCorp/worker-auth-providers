import { BaseProvider, OAuthTokens } from "../../types";
import {
	ConfigError,
	ProviderGetUserError,
	TokenError,
} from "../../utils/errors";
import { parseQuerystring } from "../../utils/helpers";
import { logger } from "../../utils/logger";
import { Linkedin } from "./types";

export async function getTokensFromCode(
	code: string,
	{ clientId, clientSecret, redirectUrl }: BaseProvider.TokensFromCodeOptions
): Promise<OAuthTokens> {
	const params = {
		grant_type: "authorization_code",
		client_id: clientId,
		client_secret: clientSecret,
		code,
		redirect_uri: redirectUrl,
	};

	const response = await fetch(
		"https://www.linkedin.com/oauth/v2/accessToken",
		{
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				accept: "application/json",
			},
			body: new URLSearchParams(params),
		}
	);

	const result: any = await response.json();
	logger.log(`[tokens], ${JSON.stringify(result)}`, "info");

	if (result.error) {
		throw new TokenError({
			message: result.error_description || "Failed to get access token",
		});
	}

	return result as OAuthTokens;
}

export async function getUser(
	token: string,
	userAgent: string = "worker-auth-providers-linkedin-oauth-login"
): Promise<Linkedin.UserResponse> {
	try {
		const headers = {
			Authorization: `Bearer ${token}`,
			"cache-control": "no-cache",
			"User-Agent": userAgent,
		};

		logger.log(`[user getUser headers], ${JSON.stringify(headers)}`, "info");

		// Get user info from OpenID Connect userinfo endpoint
		const getUserResponse = await fetch(
			"https://api.linkedin.com/v2/userinfo",
			{
				method: "GET",
				headers,
			}
		);

		if (!getUserResponse.ok) {
			const errorData: any = await getUserResponse.json();
			logger.log(
				`[provider user error], ${JSON.stringify(errorData)}`,
				"error"
			);
			// Create a properly typed error response
			return {
				id: "error",
				firstName: {
					localized: { en_US: "" },
					preferredLocale: { country: "US", language: "en" },
				},
				lastName: {
					localized: { en_US: "" },
					preferredLocale: { country: "US", language: "en" },
				},
				status: errorData.status,
				serviceErrorCode: errorData.serviceErrorCode,
				code: errorData.code,
				message: errorData.message || "LinkedIn API error",
				simplified: {
					id: "error",
					firstName: "",
					lastName: "",
					fullName: "",
					profilePicture: null,
				},
			};
		}

		const userData: any = await getUserResponse.json();
		logger.log(`[provider user data], ${JSON.stringify(userData)}`, "info");

		// Convert OpenID Connect response to match our UserResponse type
		const userResponse: Linkedin.UserResponse = {
			id: userData.sub,
			firstName: {
				localized: { en_US: userData.given_name || "" },
				preferredLocale: { country: "US", language: "en" },
			},
			lastName: {
				localized: { en_US: userData.family_name || "" },
				preferredLocale: { country: "US", language: "en" },
			},
			email: userData.email,
			profilePicture: userData.picture
				? { displayImage: userData.picture }
				: undefined,
			simplified: {
				id: userData.sub,
				firstName: userData.given_name || "",
				lastName: userData.family_name || "",
				email: userData.email,
				fullName:
					userData.name ||
					`${userData.given_name || ""} ${userData.family_name || ""}`.trim(),
				profilePicture: userData.picture || null,
			},
		};

		return userResponse;
	} catch (e: any) {
		logger.log(`[error], ${JSON.stringify(e.stack)}`, "error");
		throw new ProviderGetUserError({
			message: "There was an error fetching the user",
		});
	}
}

export default async function callback({
	options,
	request,
}: BaseProvider.CallbackOptions): Promise<Linkedin.CallbackResponse> {
	const { query }: any = parseQuerystring(request);
	logger.setEnabled(options?.isLogEnabled || false);
	logger.log(`[code], ${JSON.stringify(query.code)}`, "info");

	if (!query.code) {
		throw new ConfigError({
			message: "No code is passed!",
		});
	}

	const tokens = await getTokensFromCode(query.code, options);
	const accessToken = tokens.access_token;
	logger.log(`[access_token], ${JSON.stringify(accessToken)}`, "info");

	const providerUser = await getUser(accessToken, options?.userAgent);
	return {
		user: providerUser,
		tokens,
	};
}
