import { OAuthTokens } from "../../types";

export namespace Linkedin {
  export interface UserResponse {
    id: string;
    firstName: {
      localized: Record<string, string>;
      preferredLocale: {
        country: string;
        language: string;
      };
    };
    lastName: {
      localized: Record<string, string>;
      preferredLocale: {
        country: string;
        language: string;
      };
    };
    profilePicture?: {
      displayImage?: string;
    };
    email?: string;
    emailVerified?: boolean;
    simplified?: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      profilePicture?: string;
      fullName?: string;
    };
  }

  export interface EmailResponse {
    elements: Array<{
      handle: string;
      "handle~": {
        emailAddress: string;
      };
    }>;
  }

  export interface CallbackResponse {
    user: UserResponse;
    tokens: OAuthTokens;
  }

  export type Params = {
    client_id: string;
    redirect_uri?: string;
    scope: string;
    response_type: string;
    state?: string;
  };
}
