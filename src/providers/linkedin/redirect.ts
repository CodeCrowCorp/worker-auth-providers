import * as queryString from "query-string";
import { ConfigError } from "../../utils/errors";
import { Linkedin } from "./types";
import { BaseProvider } from "../../types";

// Default scopes for LinkedIn OAuth
// r_liteprofile: Basic profile info
// r_emailaddress: Email address
// w_member_social: Post, comment and like posts on behalf of user (optional)
const DEFAULT_SCOPE = ["r_liteprofile", "r_emailaddress"];
const DEFAULT_RESPONSE_TYPE = "code";

export default async function redirect({ options }: BaseProvider.RedirectOptions): Promise<string> {
  const { 
    clientId, 
    redirectTo, 
    redirectUrl, 
    scope = DEFAULT_SCOPE, 
    responseType = DEFAULT_RESPONSE_TYPE,
    state
  } = options;
  
  if (!clientId) {
    throw new ConfigError({
      message: "No client id passed"
    });
  }

  const params: Linkedin.Params = {
    client_id: clientId,
    response_type: responseType,
    scope: scope.join(" "),
  };

  // Use redirectTo if available, fall back to redirectUrl for backward compatibility
  if (redirectTo || redirectUrl) {
    params.redirect_uri = redirectTo || redirectUrl;
  }

  // Add state parameter if provided
  if (state) {
    params.state = state;
  }

  const paramString = queryString.stringify(params);
  const linkedinLoginUrl = `https://www.linkedin.com/oauth/v2/authorization?${paramString}`;
  return linkedinLoginUrl;
}
