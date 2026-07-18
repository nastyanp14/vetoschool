DROP TABLE IF EXISTS public.room_pet_actions CASCADE;
DROP TABLE IF EXISTS public.room_achievements CASCADE;
DROP TABLE IF EXISTS public.room_placed_items CASCADE;
DROP TABLE IF EXISTS public.room_item_purchases CASCADE;
DROP TABLE IF EXISTS public.room_pets CASCADE;

DROP FUNCTION IF EXISTS public.touch_room_updated_at() CASCADE;
