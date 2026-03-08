export interface CommandArg {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface CommandOption {
  name: string;
  description: string;
  type?: string;
}

export interface Subcommand {
  name: string;
  description: string;
  args?: CommandArg[];
  options?: CommandOption[];
  examples?: string[];
}

export interface CommandsData {
  name: string;
  description: string;
  category: string;
  platforms: string[];
  shells: string[];
  subcommands: Subcommand[];
}
