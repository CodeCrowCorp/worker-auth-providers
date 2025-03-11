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
			"X-Restli-Protocol-Version": "2.0.0",
			"User-Agent": userAgent,
		};

		logger.log(`[user getUser headers], ${JSON.stringify(headers)}`, "info");

		// Get basic profile information
		const getUserResponse = await fetch(
			"https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))",
			{
				method: "GET",
				headers,
			}
		);

		const userData: Linkedin.UserResponse = await getUserResponse.json();
		logger.log(`[provider user data], ${JSON.stringify(userData)}`, "info");

		// Get email address in a separate request
		const getEmailResponse = await fetch(
			"https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
			{
				method: "GET",
				headers,
			}
		);

		const emailData: Linkedin.EmailResponse = await getEmailResponse.json();
		logger.log(`[provider email data], ${JSON.stringify(emailData)}`, "info");

		// Extract email if available
		if (emailData && emailData.elements && emailData.elements.length > 0) {
			userData.email = emailData.elements[0]["handle~"]?.emailAddress;
		}

		// Create a simplified user object for easier consumption
		userData.simplified = {
			id: userData.id,
			firstName:
				userData.firstName?.localized[
					Object.keys(userData.firstName.localized)[0]
				] || "",
			lastName:
				userData.lastName?.localized[
					Object.keys(userData.lastName.localized)[0]
				] || "",
			email: userData.email,
			fullName: `${
				userData.firstName?.localized[
					Object.keys(userData.firstName.localized)[0]
				] || ""
			} ${
				userData.lastName?.localized[
					Object.keys(userData.lastName.localized)[0]
				] || ""
			}`.trim(),
			profilePicture: userData.profilePicture?.displayImage || null,
		};

		return userData;
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
