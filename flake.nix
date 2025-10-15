{
  description = "Nostr Wallet Connect dev environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      overlays = [
        (self: super: {
          nodejs = super.nodejs_20;
          pnpm = super.nodePackages.pnpm;
        })
      ];
      pkgs = import nixpkgs {inherit overlays system;};
      nativeBuildInputs = with pkgs;
        [
          nodejs
          pnpm
          alejandra
          gnumake
          docker-compose
          shellcheck
          shfmt
          vendir
          jq
          ytt
          buf
          bats
        ];
    in
      with pkgs; {
        devShells.default = mkShell {
          inherit nativeBuildInputs;
          shellHook = ''
            export HOST_PROJECT_PATH="$(pwd)"
            export COMPOSE_PROJECT_NAME=nostr-wallet-connect
          '';
        };

        formatter = alejandra;
      });
}
