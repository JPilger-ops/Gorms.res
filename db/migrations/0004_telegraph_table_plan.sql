CREATE TABLE "area_plan_layouts" (
	"area_id" uuid PRIMARY KEY NOT NULL,
	"floorplan_asset_id" uuid,
	"aspect_ratio" numeric(16, 10) DEFAULT 1.3333333333333333 NOT NULL,
	"background_scale" numeric(12, 8) DEFAULT 1 NOT NULL,
	"background_x" numeric(12, 8) DEFAULT 0 NOT NULL,
	"background_y" numeric(12, 8) DEFAULT 0 NOT NULL,
	"background_opacity" numeric(12, 8) DEFAULT 1 NOT NULL,
	CONSTRAINT "area_plan_layouts_values" CHECK ("area_plan_layouts"."aspect_ratio" between 0.0078125 and 128 and "area_plan_layouts"."background_scale" between 0.25 and 4 and "area_plan_layouts"."background_x" between -1 and 1 and "area_plan_layouts"."background_y" between -1 and 1 and "area_plan_layouts"."background_opacity" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "floorplan_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"area_id" uuid NOT NULL,
	"file_path" varchar(360) NOT NULL,
	"mime_type" varchar(30) DEFAULT 'image/png' NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "floorplan_assets_file_path_unique" UNIQUE("file_path"),
	CONSTRAINT "floorplan_assets_values" CHECK ("floorplan_assets"."mime_type" = 'image/png' and "floorplan_assets"."width" between 64 and 8192 and "floorplan_assets"."height" between 64 and 8192 and "floorplan_assets"."width"::bigint * "floorplan_assets"."height" <= 16777216 and "floorplan_assets"."byte_size" between 1 and 33554432)
);
--> statement-breakpoint
CREATE TABLE "physical_tables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"area_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"min_guests" integer NOT NULL,
	"max_guests" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_online_bookable" boolean DEFAULT false NOT NULL,
	"is_wheelchair_accessible" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "physical_tables_values" CHECK ("physical_tables"."min_guests" between 1 and 1000 and "physical_tables"."max_guests" between "physical_tables"."min_guests" and 1000 and length(btrim("physical_tables"."name")) > 0 and "physical_tables"."name" = btrim("physical_tables"."name"))
);
--> statement-breakpoint
CREATE TABLE "table_combination_members" (
	"combination_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	CONSTRAINT "table_combination_members_combination_id_table_id_pk" PRIMARY KEY("combination_id","table_id")
);
--> statement-breakpoint
CREATE TABLE "table_combinations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"area_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"min_guests" integer NOT NULL,
	"max_guests" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_online_bookable" boolean DEFAULT false NOT NULL,
	"is_wheelchair_accessible" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_combinations_values" CHECK ("table_combinations"."min_guests" between 1 and 1000 and "table_combinations"."max_guests" between "table_combinations"."min_guests" and 1000 and length(btrim("table_combinations"."name")) > 0 and "table_combinations"."name" = btrim("table_combinations"."name"))
);
--> statement-breakpoint
CREATE TABLE "table_layouts" (
	"table_id" uuid PRIMARY KEY NOT NULL,
	"shape" varchar(12) NOT NULL,
	"x" numeric(12, 8) NOT NULL,
	"y" numeric(12, 8) NOT NULL,
	"width" numeric(12, 8) NOT NULL,
	"height" numeric(12, 8) NOT NULL,
	"rotation" numeric(7, 3) DEFAULT 0 NOT NULL,
	"z_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "table_layouts_values" CHECK ("table_layouts"."shape" in ('round', 'square', 'rectangle') and "table_layouts"."x" between 0 and 1 and "table_layouts"."y" between 0 and 1 and "table_layouts"."width" between 0.0001 and 1 and "table_layouts"."height" between 0.0001 and 1 and "table_layouts"."rotation" >= 0 and "table_layouts"."rotation" < 360 and "table_layouts"."z_order" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "venue_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_online_bookable" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_areas_values" CHECK (length(btrim("venue_areas"."name")) > 0 and "venue_areas"."name" = btrim("venue_areas"."name") and "venue_areas"."revision" >= 0 and "venue_areas"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "area_plan_layouts" ADD CONSTRAINT "area_plan_layouts_area_id_venue_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."venue_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplan_assets" ADD CONSTRAINT "floorplan_assets_area_id_venue_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."venue_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_tables" ADD CONSTRAINT "physical_tables_area_id_venue_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."venue_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_combinations" ADD CONSTRAINT "table_combinations_area_id_venue_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."venue_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_layouts" ADD CONSTRAINT "table_layouts_table_id_physical_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."physical_tables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_areas" ADD CONSTRAINT "venue_areas_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "floorplan_assets_id_area_unique" ON "floorplan_assets" USING btree ("id","area_id");--> statement-breakpoint
CREATE INDEX "floorplan_assets_retired_idx" ON "floorplan_assets" USING btree ("retired_at");--> statement-breakpoint
CREATE UNIQUE INDEX "physical_tables_id_area_unique" ON "physical_tables" USING btree ("id","area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "physical_tables_live_name_unique" ON "physical_tables" USING btree ("area_id",lower("name")) WHERE "physical_tables"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "combination_members_table_idx" ON "table_combination_members" USING btree ("table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "table_combinations_id_area_unique" ON "table_combinations" USING btree ("id","area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "table_combinations_live_name_unique" ON "table_combinations" USING btree ("area_id",lower("name")) WHERE "table_combinations"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_areas_live_name_unique" ON "venue_areas" USING btree ("venue_id",lower("name")) WHERE "venue_areas"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "venue_areas_venue_idx" ON "venue_areas" USING btree ("venue_id","sort_order");
--> statement-breakpoint
ALTER TABLE "area_plan_layouts" ADD CONSTRAINT "area_plan_layouts_asset_area_fk" FOREIGN KEY ("floorplan_asset_id","area_id") REFERENCES "public"."floorplan_assets"("id","area_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "table_combination_members" ADD CONSTRAINT "combination_members_combination_area_fk" FOREIGN KEY ("combination_id","area_id") REFERENCES "public"."table_combinations"("id","area_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "table_combination_members" ADD CONSTRAINT "combination_members_table_area_fk" FOREIGN KEY ("table_id","area_id") REFERENCES "public"."physical_tables"("id","area_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Deferred checks allow one atomic plan save to update capacities and memberships together.
CREATE FUNCTION check_table_plan_combinations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected_areas uuid[];
BEGIN
  IF TG_OP = 'DELETE' THEN affected_areas := ARRAY[OLD.area_id];
  ELSIF TG_OP = 'UPDATE' THEN affected_areas := ARRAY[OLD.area_id, NEW.area_id];
  ELSE affected_areas := ARRAY[NEW.area_id];
  END IF;
  IF EXISTS (
    SELECT c.id FROM table_combinations c
    LEFT JOIN table_combination_members m ON m.combination_id = c.id
    LEFT JOIN physical_tables t ON t.id = m.table_id
    WHERE c.area_id = ANY(affected_areas)
    GROUP BY c.id, c.max_guests
    HAVING count(t.id) < 2 OR c.max_guests > coalesce(sum(t.max_guests), 0)
  ) THEN
    RAISE EXCEPTION 'A combination needs two distinct members and sufficient physical capacity'
      USING ERRCODE = '23514', CONSTRAINT = 'table_combination_capacity_or_members';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER table_combinations_integrity
AFTER INSERT OR UPDATE OR DELETE ON table_combinations
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_table_plan_combinations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER table_combination_members_integrity
AFTER INSERT OR UPDATE OR DELETE ON table_combination_members
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_table_plan_combinations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER physical_tables_combination_integrity
AFTER UPDATE OR DELETE ON physical_tables
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_table_plan_combinations();
--> statement-breakpoint
CREATE FUNCTION protect_floorplan_metadata() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id, NEW.area_id, NEW.file_path, NEW.mime_type, NEW.width, NEW.height, NEW.byte_size, NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id, OLD.area_id, OLD.file_path, OLD.mime_type, OLD.width, OLD.height, OLD.byte_size, OLD.created_at) THEN
    RAISE EXCEPTION 'Floorplan image metadata is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'floorplan_metadata_immutable';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER floorplan_metadata_immutable BEFORE UPDATE ON floorplan_assets
FOR EACH ROW EXECUTE FUNCTION protect_floorplan_metadata();
--> statement-breakpoint
INSERT INTO venues (id, slug, name, short_name, time_zone, availability_strategy, is_active)
VALUES ('00000000-0000-4000-8000-000000000002', 'telegraph', 'Bistrot Telegraph', 'Telegraph', 'Europe/Berlin', 'TABLES', true);
--> statement-breakpoint
INSERT INTO venue_areas (id, venue_id, name)
VALUES ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Gastraum');
--> statement-breakpoint
INSERT INTO area_plan_layouts (area_id) VALUES ('10000000-0000-4000-8000-000000000001');
